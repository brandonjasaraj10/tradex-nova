/*
  Give every day that syncs a trade a journal entry to write in.

  Before this, a synced trade landed in `trades` and nowhere else, so the
  day it happened on had no entry - the journal's own list said "No entries
  yet" for a day the trader had clearly traded, and there was nothing to open
  and annotate without creating it by hand first.

  A trigger rather than code in the sync function, for one specific reason:
  there are two sync paths. metaapi-sync runs when a user presses Sync, and
  sync-all-accounts runs on a schedule, and they carry separate copies of the
  same mapping logic. Anything added to one would have to be added to the
  other and kept there. A trigger sits under both, and under CSV import and
  manual trade entry as well, which want the same thing for the same reason.

  The timezone is the whole difficulty, and the reason this can live in the
  database at all. entry_date on a trade is an instant; entry_date on a
  journal entry is a calendar day, and which day an instant falls on depends
  entirely on where the trader is. A trade at 00:16 UTC on 1 April is
  31 March in Denver. Getting this wrong would file the entry on a day the
  app's own local-time views do not show the trade on - the exact bug this is
  meant to fix, moved somewhere harder to see. user_profiles.timezone is
  populated for every account, so the conversion is done properly.
*/

CREATE OR REPLACE FUNCTION public.ensure_journal_entry_for_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
  v_local_date date;
  v_folder_id uuid;
BEGIN
  /*
    Synced trades only. A trade typed in by hand was entered from a journal
    entry that already exists, and a CSV import of two years of history
    should not silently manufacture five hundred empty entries.
  */
  IF NEW.external_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(timezone, 'UTC') INTO v_timezone
  FROM user_profiles WHERE user_id = NEW.user_id LIMIT 1;

  v_local_date := (NEW.entry_date AT TIME ZONE coalesce(v_timezone, 'UTC'))::date;

  SELECT id INTO v_folder_id
  FROM journal_folders
  WHERE user_id = NEW.user_id AND name = 'Daily Journal'
  LIMIT 1;

  -- No folder means an account whose defaults never got created. Skip rather
  -- than invent a folder here; the journal builds its own on first load.
  IF v_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  /*
    One statement, not a SELECT then an INSERT. A sync writes a day's trades
    in a single batch, and separate check-then-insert calls would race each
    other into two entries for the same day. The journal deliberately allows
    several entries per day ("Add Another Entry"), so a unique constraint is
    not available to catch it - the guard has to be inside the write.
  */
  INSERT INTO journal_entries (user_id, folder_id, title, content, entry_date, account_id, entry_type)
  SELECT
    NEW.user_id,
    v_folder_id,
    to_char(v_local_date, 'MM-DD-YYYY') || ' Entry 1',
    '',
    v_local_date,
    NEW.broker_id,
    'general'
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries e
    WHERE e.user_id = NEW.user_id
      AND e.entry_date = v_local_date
      AND e.account_id IS NOT DISTINCT FROM NEW.broker_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_for_synced_trades ON public.trades;

CREATE TRIGGER trg_journal_entry_for_synced_trades
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_journal_entry_for_trade();
