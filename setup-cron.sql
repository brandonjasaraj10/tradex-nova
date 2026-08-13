-- TradeX Auto-Sync Cron Job Setup
-- Run this in your Supabase SQL Editor after adding the secrets

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (for re-running this script)
SELECT cron.unschedule('sync-all-metatrader-accounts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts'
);

-- Schedule auto-sync to run every 10 minutes
-- IMPORTANT: Replace YOUR_PROJECT_REF with your actual Supabase project reference
SELECT cron.schedule(
  'sync-all-metatrader-accounts',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '4vA0KzKAp7l7JHPvmSV0VTkvCI6nTQi23LLpxRWORNI='
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify the cron job was created
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'sync-all-metatrader-accounts';

-- View recent cron execution logs (run this after 10 minutes to see if it's working)
-- SELECT
--   start_time,
--   end_time,
--   status,
--   return_message
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts')
-- ORDER BY start_time DESC
-- LIMIT 10;
