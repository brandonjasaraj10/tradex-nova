/*
  File a synced trade's journal entry on the day it CLOSED.

  The trigger used the open timestamp, which put a trade opened at 11pm and
  closed the next morning on the wrong day - and disagreed with the Calendar,
  which has always filtered on exit_date. On the account this was found on, 4
  of 25 trades crossed midnight, carrying $1,479 that the calendar and the
  journal each attributed to a different day.

  Close date is the answer everywhere else too: the money does not exist
  until the position closes, a broker statement attributes it to the close
  date, and every prop firm measures its daily loss limit on realised P&L per
  day. A trade closed on Tuesday counts against Tuesday's limit. Filing it
  under Monday would tell a trader they had room left on the day they were
  closest to breaching.

  The title now carries the close time for the same reason: it labels the
  entry on the day the entry sits.
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
  v_size text;
BEGIN
  IF NEW.external_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(timezone, 'UTC') INTO v_timezone
  FROM user_profiles WHERE user_id = NEW.user_id LIMIT 1;
  v_timezone := coalesce(v_timezone, 'UTC');

  /* The close, not the open. */
  v_local_time := coalesce(NEW.exit_date, NEW.entry_date) AT TIME ZONE v_timezone;
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

  v_size := CASE WHEN position('.' in NEW.quantity::text) > 0
                 THEN rtrim(rtrim(NEW.quantity::text, '0'), '.')
                 ELSE NEW.quantity::text END;
  IF NEW.quantity_unit IS NOT NULL THEN
    v_size := v_size || ' ' || NEW.quantity_unit;
  END IF;

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
    v_size,
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

/*
  Move the entries that are on the wrong day, and retitle them to the close
  time. Anything the trader has written moves with the entry: it is the same
  trade, it is simply on the correct day now.
*/
UPDATE public.journal_entries e
SET entry_date = (t.exit_date AT TIME ZONE coalesce(up.timezone, 'UTC'))::date,
    title = CASE
      WHEN e.title ~ '^\d{2}:\d{2} '
      THEN to_char(t.exit_date AT TIME ZONE coalesce(up.timezone, 'UTC'), 'HH24:MI')
           || substring(e.title from 6)
      ELSE e.title
    END
FROM public.trades t
LEFT JOIN public.user_profiles up ON up.user_id = t.user_id
WHERE e.trade_id = t.id
  AND t.exit_date IS NOT NULL
  AND e.entry_date <> (t.exit_date AT TIME ZONE coalesce(up.timezone, 'UTC'))::date;
