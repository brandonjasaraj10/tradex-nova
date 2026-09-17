/*
  Run the orphan sweep every hour.

  Hourly rather than daily because the job is tiny - one list call to
  MetaApi and two small reads - and because an orphan costs real money for
  every hour it survives. It pairs with the one-hour quarantine in the
  function: an account first seen unreferenced at one run is released at the
  next, so a leak stops billing within about two hours instead of whenever
  somebody thinks to look.

  Note this passes apply, unlike a hand-run dry check. The whole point is
  that it acts without anyone watching, which is why the refusals live in
  the function rather than in whoever calls it: it aborts if the connections
  read fails, if we reference no accounts at all, or if more than five come
  due at once.

  Same shape as the other scheduled jobs here: the secret lives in
  internal_config rather than in this file, so nothing secret is committed,
  and the edge function checks the X-Cron-Secret header before doing
  anything.
*/

CREATE OR REPLACE FUNCTION trigger_metaapi_reconcile()
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
    RAISE WARNING 'cron_secret not found in internal_config - skipping MetaApi reconcile';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/reconcile-metaapi-accounts',
    headers := jsonb_build_object('X-Cron-Secret', v_secret, 'Content-Type', 'application/json'),
    body := '{"apply": true}'::jsonb
  );
END;
$$;

/* Replace rather than add, so re-running this migration can't double-schedule. */
SELECT cron.schedule(
  'reconcile-metaapi-accounts',
  '17 * * * *',
  $$SELECT trigger_metaapi_reconcile();$$
);
