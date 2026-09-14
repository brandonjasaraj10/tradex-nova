/*
  One email to people who signed up and never subscribed.

  Context from the real data at the time of writing: 350 accounts, 15 paying,
  250 who signed up and never subscribed - and of those 250, exactly one has
  ever logged a trade. That is not cart abandonment by someone who tried the
  product; the paywall sits in front of everything, so they saw a price and
  left. The email is written for that person, not for a lapsed user.

  Three things this has to get right, and each has a table or a switch here:

  1. Nobody is emailed twice. abandon_signup_emails records every send.
  2. Anybody can stop it. email_suppressions is a real unsubscribe list and
     is checked before every send. There was no opt-out mechanism in this
     project at all before now.
  3. It does not go out in a burst. tradexnova.com has little sending
     history, and 250 messages in one night from a domain like that is how a
     domain gets filtered - including for password resets, which would be a
     genuinely bad outcome. The function rate-limits itself; see the cap in
     send-abandon-email.
*/

-- Who has already been sent one, so nobody gets a second.
CREATE TABLE IF NOT EXISTS abandon_signup_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  /*
    Random and unguessable, so the unsubscribe link needs no login and no
    signature scheme - the token is the proof.
  */
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS abandon_signup_emails_token_idx
  ON abandon_signup_emails (unsubscribe_token);

-- The opt-out list. Checked before any non-transactional send.
CREATE TABLE IF NOT EXISTS email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_suppressions_email_idx ON email_suppressions (lower(email));
CREATE INDEX IF NOT EXISTS email_suppressions_user_idx ON email_suppressions (user_id);

/*
  RLS on both. Neither is ever read by a client - the edge function uses the
  service role - so enabling RLS with no policy is the correct, closed
  position rather than an oversight. It matches nova_chat_rate_limits, which
  is the same shape: touched only by trusted server code.
*/
ALTER TABLE abandon_signup_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

/*
  The kill switch, defaulting to OFF.

  Deploying the mechanism and starting to email 250 real people are two
  different decisions, and this keeps them apart. The cron job runs from the
  moment this migration lands, finds the flag off, and does nothing. Flip it
  to 'true' when the send has actually been tested.
*/
INSERT INTO internal_config (key, value)
VALUES ('abandon_emails_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION trigger_abandon_signup_emails()
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
    RAISE WARNING 'cron_secret not found in internal_config - skipping abandon emails';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/send-abandon-email',
    headers := jsonb_build_object('X-Cron-Secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

/*
  Once a day, at 16:00 UTC - late morning in Denver, which is a reasonable
  hour to arrive in somebody's inbox in the US where most of this audience
  is. Not a schedule that emails people at 4am.
*/
SELECT cron.schedule(
  'send-abandon-emails',
  '0 16 * * *',
  $$SELECT trigger_abandon_signup_emails();$$
);

/*
  Who gets one, and in what order.

  Newest first is the important part. Taking the oldest 25 would mean
  somebody who signs up today waits three weeks for an email meant to arrive
  tomorrow, while the backlog drains ahead of them. Ordering by signup date
  descending serves everyone newly eligible first and spends whatever
  capacity is left on the backlog, so the steady state stays correct while
  the 250 drain behind it.

  SECURITY DEFINER because it reads auth.users, and it is callable only by
  the service role - the edge function behind a cron secret.
*/
CREATE OR REPLACE FUNCTION abandon_email_candidates(wait_hours int, max_rows int)
RETURNS TABLE (id uuid, email text, created_at timestamptz)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE sql
AS $$
  SELECT u.id, u.email::text, u.created_at
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND u.created_at < now() - make_interval(hours => wait_hours)
    -- never emailed before
    AND NOT EXISTS (
      SELECT 1 FROM abandon_signup_emails a WHERE a.user_id = u.id
    )
    -- never opted out
    AND NOT EXISTS (
      SELECT 1 FROM email_suppressions s
      WHERE s.user_id = u.id OR lower(s.email) = lower(u.email)
    )
    -- not a paying customer, and not mid-trial
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions sub
      WHERE sub.user_id = u.id AND sub.status IN ('active', 'trialing')
    )
  ORDER BY u.created_at DESC
  LIMIT max_rows;
$$;

REVOKE ALL ON FUNCTION abandon_email_candidates(int, int) FROM PUBLIC, anon, authenticated;
