/*
  Backfill an entry for every trade that synced before the per-trade rule
  existed.

  Same rules as the trigger so the two cannot disagree: synced trades only,
  the local date and time from user_profiles.timezone, keyed on trade_id so
  it cannot run twice, and manual_pnl left NULL so the money is counted once,
  from the trade.
*/

INSERT INTO public.journal_entries (
  user_id, folder_id, title, content, entry_date, account_id, entry_type,
  trade_id, symbol, direction, position_size, trade_duration
)
SELECT
  t.user_id,
  f.id,
  to_char(t.local_time, 'HH24:MI') || ' ' || t.symbol || ' ' ||
    initcap(lower(t.direction)),
  '',
  t.local_time::date,
  t.broker_id,
  'trade',
  t.id,
  t.symbol,
  upper(t.direction),
  trim(to_char(t.quantity, 'FM999999990.####')),
  CASE WHEN t.minutes IS NULL THEN NULL
       WHEN t.minutes < 60 THEN t.minutes::int || ' minutes'
       ELSE round(t.minutes / 60, 1)::text || ' hours'
  END
FROM (
  SELECT
    tr.id, tr.user_id, tr.broker_id, tr.symbol, tr.direction, tr.quantity,
    (tr.entry_date AT TIME ZONE coalesce(up.timezone, 'UTC')) AS local_time,
    CASE WHEN tr.exit_date IS NOT NULL
         THEN round(extract(epoch FROM (tr.exit_date - tr.entry_date)) / 60)
    END AS minutes
  FROM public.trades tr
  LEFT JOIN public.user_profiles up ON up.user_id = tr.user_id
  WHERE tr.external_id IS NOT NULL
) t
JOIN public.journal_folders f
  ON f.user_id = t.user_id AND f.name = 'Daily Journal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.journal_entries e WHERE e.trade_id = t.id
);
