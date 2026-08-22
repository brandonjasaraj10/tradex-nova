/*
  Throttle password reset REQUESTS.

  Guessing a code was already limited - five wrong attempts and the code is
  destroyed - but asking for a new code was completely unlimited. Anyone
  could POST that endpoint with someone else's address indefinitely.

  Three consequences, worst last:
    - the victim's inbox is flooded, which is a harassment vector
    - every request sends a real Resend email, so it costs money
    - repeatedly mailing one address is precisely what damages sender
      reputation, and this domain's Primary-inbox placement is what the
      launch email depends on

  Cannot be counted from password_reset_codes, because the request path
  deletes any existing code before inserting the new one - there is nothing
  left to count. Hence a separate log.

  Deliberately records EVERY request, whether or not the address belongs to
  a real account. Throttling only real accounts would turn the 429 into an
  account-existence oracle, defeating the "if an account exists" wording the
  endpoint already uses to avoid confirming who is registered.
*/

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_requests_email_time_idx
  ON public.password_reset_requests (email, created_at DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
-- No policies: written and read only by the edge function's service role.
-- A client has no reason to see who has been requesting resets.

/*
  Returns true when the request is allowed, and records it. Doing both in
  one statement keeps the check and the record atomic - two requests landing
  together cannot both read "2 so far" and both proceed.

  Three per address per 15 minutes. A real person locked out asks once,
  maybe twice; reaching three means they already have three unused codes
  sitting in their inbox.
*/
CREATE OR REPLACE FUNCTION public.check_and_record_reset_request(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent int;
  v_window constant interval := interval '15 minutes';
  v_max constant int := 3;
BEGIN
  SELECT count(*) INTO v_recent
  FROM public.password_reset_requests
  WHERE email = lower(p_email)
    AND created_at > now() - v_window;

  IF v_recent >= v_max THEN
    RETURN false;
  END IF;

  INSERT INTO public.password_reset_requests (email)
  VALUES (lower(p_email));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_record_reset_request(text) FROM PUBLIC, anon, authenticated;

-- Keep the log from growing forever; nothing older than a day matters to a
-- 15 minute window.
CREATE OR REPLACE FUNCTION public.cleanup_password_reset_requests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.password_reset_requests WHERE created_at < now() - interval '1 day';
$$;

SELECT cron.schedule(
  'cleanup-password-reset-requests',
  '15 3 * * *',
  'SELECT public.cleanup_password_reset_requests();'
);
