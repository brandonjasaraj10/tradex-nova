/*
  Run the broker sync on a schedule.

  Hourly rather than more often, because of how MetaApi bills. Starting a
  stopped account is charged as six hours minimum, so waking one every few
  minutes costs the same as leaving it running - there is no cheaper middle
  ground between "always on" and "a few times a day". Hourly keeps a
  continuously-deployed account current without ever being the reason a
  stopped one gets started.

  Same shape as the other scheduled jobs here: the secret lives in
  internal_config rather than in this file, so nothing secret is committed,
  and the edge function checks the X-Cron-Secret header before doing
  anything.
*/

CREATE OR REPLACE FUNCTION trigger_broker_sync()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM internal_config WHERE key = 'cron_secret';
  IF v_secret IS NULL THEN
    RAISE WARNING 'cron_secret not found in internal_config - skipping broker sync';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/sync-all-accounts',
    headers := jsonb_build_object('X-Cron-Secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

/* Replace rather than add, so re-running this migration can't double-schedule. */
SELECT cron.unschedule('sync-broker-accounts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-broker-accounts');

SELECT cron.schedule(
  'sync-broker-accounts',
  '7 * * * *',
  $$SELECT trigger_broker_sync();$$
);
