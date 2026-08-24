/*
  # Welcome email on signup

  Creating an account sent nothing at all. Email confirmation is off, there
  was no welcome mail, and Stripe does not receipt a $0 trial - so somebody
  could sign up, hand over a card, and receive silence. This adds the one
  message that should always exist.

  Fired from a trigger on auth.users rather than from the client, so it goes
  out however the account was made - the signup form, Google sign-in, or
  anything added later - and cannot be lost by closing the tab mid-signup.

  Same arrangement as the waitlist sync: net.http_post carries a shared
  secret in a header, because a trigger has no user JWT to present, and the
  function refuses anything without it.
*/

-- 32 random bytes. Generated here rather than hardcoded so it never exists
-- outside this database; internal_config has RLS on with no policies, so
-- only service_role and SECURITY DEFINER functions can read it.
INSERT INTO internal_config (key, value)
VALUES ('welcome_email_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_new_user_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_secret text;
BEGIN
  /*
    Nothing in here may prevent an account from being created.

    This runs inside the INSERT on auth.users, so an unhandled error would
    roll the signup back - and someone would be unable to register because a
    marketing email failed. A missing secret, a pg_net hiccup, anything at
    all: log nothing, block nothing, let the account through. The email is
    the nice-to-have; the account is the point.
  */
  BEGIN
    IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
      RETURN NEW;
    END IF;

    SELECT value INTO v_secret FROM internal_config WHERE key = 'welcome_email_secret';

    IF v_secret IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/send-welcome-email',
      body := jsonb_build_object('record', jsonb_build_object('email', NEW.email)),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', v_secret
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_send_welcome_email ON auth.users;

CREATE TRIGGER trigger_send_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_user_welcome();
