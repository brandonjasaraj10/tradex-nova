/*
  One journal entry per synced trade, with the trade's own details already
  filled in.

  Replaces the previous rule of one empty entry per day. That gave the day a
  container and nothing else: the entry form's fields are Symbol/Pair,
  Direction, Position Size and Trade Duration - trade-level questions that a
  single daily entry cannot answer when the day held three different trades.
  An entry that exists but is blank is barely better than no entry.

  manual_pnl is deliberately left NULL, and this is the one thing not to
  "fix" later. A journal entry carrying manual_pnl is treated as a real
  logged trade in its own right by the Dashboard, Analytics, the Calendar,
  Nova and getAllUnifiedTrades - that is how hand-written trades get counted.
  Copying a synced trade's P&L into its entry would count that trade twice
  everywhere in the app: a -$6,796 day would read -$13,592. The entry points
  at the trade through trade_id instead, and the trade remains the single
  source of the money.

  Titled with the local time so several trades in the same symbol on the same
  day stay distinguishable, and so they sort in the order they happened.
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
  v_local_time timestamp;
  v_folder_id uuid;
  v_minutes numeric;
BEGIN
  IF NEW.external_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(timezone, 'UTC') INTO v_timezone
  FROM user_profiles WHERE user_id = NEW.user_id LIMIT 1;
  v_timezone := coalesce(v_timezone, 'UTC');

  v_local_time := NEW.entry_date AT TIME ZONE v_timezone;
  v_local_date := v_local_time::date;

  SELECT id INTO v_folder_id
  FROM journal_folders
  WHERE user_id = NEW.user_id AND name = 'Daily Journal'
  LIMIT 1;

  IF v_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.exit_date IS NOT NULL THEN
    v_minutes := round(extract(epoch FROM (NEW.exit_date - NEW.entry_date)) / 60);
  END IF;

  /*
    Keyed on trade_id, so a re-sync that touches the same trade cannot make a
    second entry for it, and so anything the trader has since written in that
    entry is never overwritten.
  */
  INSERT INTO journal_entries (
    user_id, folder_id, title, content, entry_date, account_id, entry_type,
    trade_id, symbol, direction, position_size, trade_duration
  )
  SELECT
    NEW.user_id,
    v_folder_id,
    to_char(v_local_time, 'HH24:MI') || ' ' || NEW.symbol || ' ' ||
      initcap(lower(NEW.direction)),
    '',
    v_local_date,
    NEW.broker_id,
    'trade',
    NEW.id,
    NEW.symbol,
    upper(NEW.direction),
    trim(to_char(NEW.quantity, 'FM999999990.####')),
    CASE WHEN v_minutes IS NULL THEN NULL
         WHEN v_minutes < 60 THEN v_minutes::int || ' minutes'
         ELSE round(v_minutes / 60, 1)::text || ' hours'
    END
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries e WHERE e.trade_id = NEW.id
  );

  RETURN NEW;
END;
$$;
