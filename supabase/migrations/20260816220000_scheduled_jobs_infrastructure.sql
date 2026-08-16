/*
  # Scheduled job infrastructure

  ## What this adds
  1. pg_cron, so periodic jobs can run without external scheduling infra.
  2. cleanup_expired_reset_codes() - already existed in an earlier migration
     file but was never actually created on this live database (same
     schema-drift pattern as everywhere else in this project). Recreated
     here and actually scheduled this time.
  3. notify_unreviewed_trades() - once daily, tells a user if they logged
     trades yesterday but never wrote a journal entry for that day.
  4. notify_adherence_trend() - once weekly, tells a user if their trading
     rule adherence dropped 15+ points from the prior week (only fires
     when there's a real prior-week baseline to compare against).
  5. Schedules all three, plus a call to the reconcile-subscriptions edge
     function (defensive drift correction against Stripe - webhooks are
     reliable most of the time, not always).

  Deliberately not included: trial-ending-soon reminders - explicitly
  asked to leave that one out.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Password reset code cleanup (daily, 3am UTC)
DROP FUNCTION IF EXISTS cleanup_expired_reset_codes() CASCADE;
CREATE FUNCTION cleanup_expired_reset_codes()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < now();
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-reset-codes',
  '0 3 * * *',
  $$SELECT cleanup_expired_reset_codes();$$
);

-- 2. Unreviewed trades nudge (daily, 8am UTC)
CREATE OR REPLACE FUNCTION notify_unreviewed_trades()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_yesterday date := (current_date - 1);
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT t.user_id, count(*) AS trade_count
    FROM trades t
    WHERE t.entry_date::date = v_yesterday
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.user_id = t.user_id AND je.entry_date = v_yesterday
      )
    GROUP BY t.user_id
  LOOP
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      rec.user_id,
      'Unreviewed trades from yesterday',
      format(
        'You logged %s trade%s yesterday with no journal entry. Add one to reflect on your trading day.',
        rec.trade_count,
        CASE WHEN rec.trade_count = 1 THEN '' ELSE 's' END
      ),
      'info'
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'notify-unreviewed-trades',
  '0 8 * * *',
  $$SELECT notify_unreviewed_trades();$$
);

-- 3. Rule adherence trend (weekly, Monday 8am UTC - looks back at the
-- week that just ended vs the week before it)
CREATE OR REPLACE FUNCTION notify_adherence_trend()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_week_start date := date_trunc('week', current_date)::date - 7;
  v_recent_week_end date := date_trunc('week', current_date)::date - 1;
  v_prior_week_start date := v_recent_week_start - 7;
  rec RECORD;
BEGIN
  FOR rec IN
    WITH recent_week AS (
      SELECT je.user_id,
        count(*) FILTER (WHERE jer.followed) * 100.0 / NULLIF(count(*), 0) AS adherence
      FROM journal_entry_rules jer
      JOIN journal_entries je ON je.id = jer.journal_entry_id
      WHERE je.entry_date BETWEEN v_recent_week_start AND v_recent_week_end
      GROUP BY je.user_id
    ),
    prior_week AS (
      SELECT je.user_id,
        count(*) FILTER (WHERE jer.followed) * 100.0 / NULLIF(count(*), 0) AS adherence
      FROM journal_entry_rules jer
      JOIN journal_entries je ON je.id = jer.journal_entry_id
      WHERE je.entry_date BETWEEN v_prior_week_start AND (v_recent_week_start - 1)
      GROUP BY je.user_id
    )
    SELECT
      pw.user_id,
      round(pw.adherence) AS prior_adherence,
      round(coalesce(rw.adherence, 0)) AS recent_adherence
    FROM prior_week pw
    LEFT JOIN recent_week rw ON rw.user_id = pw.user_id
    WHERE pw.adherence IS NOT NULL
      AND (pw.adherence - coalesce(rw.adherence, 0)) >= 15
  LOOP
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      rec.user_id,
      'Rule adherence dropped',
      format(
        'Your trading rule adherence dropped from %s%% the week before to %s%% last week. Worth a look.',
        rec.prior_adherence,
        rec.recent_adherence
      ),
      'warning'
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'notify-adherence-trend',
  '0 8 * * 1',
  $$SELECT notify_adherence_trend();$$
);

-- 4. Stripe subscription reconciliation (daily, 4am UTC) - calls the
-- reconcile-subscriptions edge function via pg_net, same pattern already
-- used for the waitlist->Resend sync trigger. Secret read from
-- internal_config rather than hardcoded (never committed to git).
CREATE OR REPLACE FUNCTION trigger_subscription_reconciliation()
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
    RAISE WARNING 'cron_secret not found in internal_config - skipping reconciliation';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/reconcile-subscriptions',
    headers := jsonb_build_object('X-Cron-Secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'reconcile-subscriptions',
  '0 4 * * *',
  $$SELECT trigger_subscription_reconciliation();$$
);
