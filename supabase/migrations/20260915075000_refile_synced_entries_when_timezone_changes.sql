/*
  Move a trader's synced journal entries when their timezone is corrected.

  A synced trade is filed on the day it closed in the user's timezone. Almost
  every account carried 'UTC' without meaning it, so a trade closing at 01:54
  UTC - evening in the Americas, and prime trading hours - was filed to the
  following day while the rest of the app showed it on the previous one.

  The app now detects the real timezone from the browser and saves it. That
  fixes new trades, and does nothing at all for entries already filed under
  the wrong one. A one-off backfill would not help either: the timezones are
  corrected gradually, as each person next opens the app, so a backfill run
  today would find almost every profile still saying UTC and correct nothing.

  So the repair is attached to the correction. Whenever a timezone actually
  changes, that user's synced entries are re-filed to match - which happens
  once per account, on whatever day they next load the app, without anybody
  having to remember to run anything.

  Only entries created from a synced trade are touched (e.trade_id IS NOT
  NULL). A hand-written entry sits on the day its author put it on, and a
  timezone change is not permission to move somebody's own notes.
*/

CREATE OR REPLACE FUNCTION public.refile_synced_entries_for_timezone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.journal_entries e
  SET entry_date = (t.exit_date AT TIME ZONE coalesce(NEW.timezone, 'UTC'))::date,
      title = CASE
        WHEN e.title ~ '^\d{2}:\d{2} '
        THEN to_char(t.exit_date AT TIME ZONE coalesce(NEW.timezone, 'UTC'), 'HH24:MI')
             || substring(e.title from 6)
        ELSE e.title
      END
  FROM public.trades t
  WHERE e.trade_id = t.id
    AND e.user_id = NEW.user_id
    AND t.exit_date IS NOT NULL
    AND e.entry_date
        <> (t.exit_date AT TIME ZONE coalesce(NEW.timezone, 'UTC'))::date;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refile_synced_entries_for_timezone ON public.user_profiles;

CREATE TRIGGER trg_refile_synced_entries_for_timezone
  AFTER UPDATE OF timezone ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.timezone IS DISTINCT FROM NEW.timezone)
  EXECUTE FUNCTION public.refile_synced_entries_for_timezone();

/*
  And the entries already misfiled under a timezone that is already correct -
  the handful of accounts that had set one before today.
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
