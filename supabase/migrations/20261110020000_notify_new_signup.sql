/*
  Email Brandon on every new signup.

  Fires when a user_profiles row is created - the name screen every new
  account passes through - and hands the user id to the notify-new-signup
  edge function via pg_net, the same way the waitlist sync works. That
  function sends the email through Resend to the address the waitlist alerts
  already use.

  The shared secret is not in this file: it is in internal_config
  (key signup_alert_secret, RLS on, no policies), inserted by a direct query.

  pg_net is fire-and-forget, so a slow or failed email can never hold up or
  break the signup itself.

  Undo: DROP TRIGGER trigger_notify_new_signup ON public.user_profiles;
*/

CREATE OR REPLACE FUNCTION public.notify_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM internal_config WHERE key = 'signup_alert_secret';
  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/notify-new-signup',
    body := jsonb_build_object('user_id', NEW.user_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_notify_new_signup ON public.user_profiles;
CREATE TRIGGER trigger_notify_new_signup
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_signup();
