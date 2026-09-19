/*
  Create the missing journal entries for trades that synced before the
  trigger existed.

  The trigger added in the previous migration fires on INSERT, so it only
  ever helps trades that arrive after it. Everything already synced - 25
  trades over 11 trading days on the first connected account - still had no
  entry, which is exactly the symptom the trigger was meant to remove: the
  day showed its trades and then "No entries yet", with nothing to open.

  Same rules as the trigger, deliberately: synced trades only, the local date
  from user_profiles.timezone rather than UTC, one entry per account per day,
  and never where an entry already exists. Safe to run twice.
*/

INSERT INTO public.journal_entries
  (user_id, folder_id, title, content, entry_date, account_id, entry_type)
SELECT DISTINCT ON (t.user_id, t.broker_id, local_date)
  t.user_id,
  f.id,
  to_char(local_date, 'MM-DD-YYYY') || ' Entry 1',
  '',
  local_date,
  t.broker_id,
  'general'
FROM (
  SELECT
    tr.user_id,
    tr.broker_id,
    (tr.entry_date AT TIME ZONE coalesce(up.timezone, 'UTC'))::date AS local_date
  FROM public.trades tr
  LEFT JOIN public.user_profiles up ON up.user_id = tr.user_id
  WHERE tr.external_id IS NOT NULL
) t
JOIN public.journal_folders f
  ON f.user_id = t.user_id AND f.name = 'Daily Journal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.journal_entries e
  WHERE e.user_id = t.user_id
    AND e.entry_date = t.local_date
    AND e.account_id IS NOT DISTINCT FROM t.broker_id
);
