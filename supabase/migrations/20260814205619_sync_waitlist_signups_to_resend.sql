/*
  # Auto-sync new waitlist signups to Resend

  ## Purpose
  User wants the waitlist connected to Resend so a future launch
  announcement can go out to everyone who signed up. Every new waitlist
  signup now fires an async HTTP call (via pg_net, the same extension
  Supabase's own Database Webhooks feature uses) to the
  resend-waitlist-sync edge function, which adds the email as a Resend
  contact in a "Waitlist" segment.

  ## Security
  The edge function is deployed with --no-verify-jwt (this call comes
  from Postgres, not a logged-in user) and instead checks a shared
  secret header, matching the CRON_SECRET pattern already used
  elsewhere in this project for internal-only trigger calls.

  The actual secret value is NOT in this file - ALTER DATABASE ... SET
  isn't available on this hosted project (permission denied, no
  superuser), so it's stored in this small internal_config table
  instead (RLS enabled, no policies, so nothing but the table owner /
  SECURITY DEFINER functions can read it) and inserted separately via
  a direct query, not through a committed migration. Keeping real
  secret values out of files that go into git is the whole reason this
  project had to scrub its git history once already this session.
*/

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE internal_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.notify_waitlist_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM internal_config WHERE key = 'waitlist_sync_secret';

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/resend-waitlist-sync',
    body := jsonb_build_object('record', jsonb_build_object('email', NEW.email)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_waitlist_resend_sync ON public.waitlist;
CREATE TRIGGER trigger_waitlist_resend_sync
  AFTER INSERT ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_signup();
