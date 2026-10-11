/*
  Four emails across the 14-day trial.

  Until now a trial was fourteen days of silence: a welcome email at signup,
  then nothing until the card was charged. The onboarding research is
  consistent that the trial period is where activation is won or lost, and
  that what works is personal - Henry's churn went from 16% to 6% when the
  post-signup sequence was built from what each person had said. Onboarding
  now collects exactly that (goal, why journaling failed before, the goal
  length, daily minutes, their struggle), so these emails spend it.

    day1     - their goal, handed back; log the first trade.
    day3     - one specific thing to watch, from the struggle they named.
    day7     - halfway, with their real count of journaled days.
    reminder - two days before the first charge: the date, the amount, and
               how to cancel. Honest on purpose: a customer was once charged
               after cancelling and convinced he had been scammed, and a
               clear reminder is the cheapest fix for that there is.

  Same safety rails as the abandoned-signup email (20260913230000):
  - trial_emails records every send, one row per person per kind, written
    BEFORE the send so nothing is ever sent twice.
  - email_suppressions is honoured for the three nudges. The billing
    reminder is a service notice about money and goes regardless.
  - internal_config.trial_emails_enabled defaults to 'false', so applying
    this and starting to send are separate decisions.
*/

CREATE TABLE IF NOT EXISTS trial_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('day1', 'day3', 'day7', 'reminder')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE (user_id, kind)
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_emails_token_idx ON trial_emails (unsubscribe_token);

-- Touched only by the service role, like abandon_signup_emails.
ALTER TABLE trial_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO internal_config (key, value)
VALUES ('trial_emails_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

/*
  Everybody currently trialling, with what the emails need to be personal.
  The function decides which (if any) email is due; this only gathers.
*/
CREATE OR REPLACE FUNCTION trial_email_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  trial_start timestamptz,
  trial_end timestamptz,
  unit_amount integer,
  billing_interval text,
  plan_type text,
  onboarding_profile jsonb,
  struggle text,
  journaled_days integer,
  suppressed boolean,
  sent_kinds text[]
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE sql
AS $$
  SELECT
    s.user_id,
    u.email::text,
    nullif(trim(p.first_name), '')::text,
    s.current_period_start,
    s.current_period_end,
    s.unit_amount,
    s.billing_interval,
    s.plan_type,
    p.onboarding_profile,
    p.onboarding_struggle,
    (
      SELECT count(DISTINCT j.entry_date)::int
      FROM journal_entries j
      WHERE j.user_id = s.user_id
        AND j.is_tour_demo = false
        AND j.entry_date >= (s.current_period_start AT TIME ZONE 'UTC')::date
    ),
    EXISTS (
      SELECT 1 FROM email_suppressions x
      WHERE x.user_id = s.user_id OR lower(x.email) = lower(u.email)
    ),
    coalesce(
      (SELECT array_agg(t.kind) FROM trial_emails t WHERE t.user_id = s.user_id),
      ARRAY[]::text[]
    )
  FROM subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN user_profiles p ON p.user_id = s.user_id
  WHERE s.status = 'trialing'
    AND u.email IS NOT NULL
    AND s.current_period_start IS NOT NULL
    AND s.current_period_end IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION trial_email_candidates() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION trigger_trial_emails()
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
    RAISE WARNING 'cron_secret not found in internal_config - skipping trial emails';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/send-trial-emails',
    headers := jsonb_build_object('X-Cron-Secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

/* Daily at 16:00 UTC, alongside the abandoned-signup email. */
SELECT cron.schedule(
  'send-trial-emails',
  '0 16 * * *',
  $$SELECT trigger_trial_emails();$$
);
