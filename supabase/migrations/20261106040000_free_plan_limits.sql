/*
  Free plan limits: 5 entries and 3 Nova voice entries a week, 2 screenshots an
  entry, 1 account. The first 7 days after signup allow 15 entries and 13 voice
  entries. Weeks turn over at Sunday midnight UTC.

  Additive and inert when applied: nothing calls these yet. The three enforce
  functions get attached as triggers in the migration that opens the app to
  free users, because until then RLS keeps those users out of these tables
  anyway. Accounts with paid access pass straight through all of it.
*/

/*
  A record of what was used, separate from the entries themselves, so deleting
  an entry does not hand the slot back. Deliberately no foreign key to
  journal_entries for the same reason.
*/
CREATE TABLE IF NOT EXISTS public.free_plan_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('entry', 'voice')),
  ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, ref)
);

CREATE INDEX IF NOT EXISTS free_plan_usage_window_idx
  ON public.free_plan_usage (user_id, kind, created_at);

/* No policies: only the functions below ever touch it. */
ALTER TABLE public.free_plan_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_plan_usage FROM PUBLIC, anon, authenticated;

/*
  has_active_subscription() answers for whoever is signed in, which is nobody
  when an edge function writes with the service role (broker-api creates
  accounts that way). This answers for a named user. The rules must stay the
  same as has_active_subscription().
*/
CREATE OR REPLACE FUNCTION public.free_plan_user_is_paid(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = p_user_id
        AND lower(coalesce(u.email, '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = p_user_id
        AND (
          s.status IN ('active', 'trialing')
          OR (
            s.status = 'canceled'
            AND s.current_period_end > now()
            AND coalesce(s.cancellation_reason, '') NOT IN ('payment_failed', 'payment_disputed')
          )
        )
    );
$$;

/*
  The period being counted and what it allows. The first 7 days run from signup
  rather than the calendar. The first ordinary week starts when they end, so
  what was used during the bonus does not count against the normal allowance.
*/
CREATE OR REPLACE FUNCTION public.free_plan_window(p_user_id uuid)
RETURNS TABLE (window_start timestamptz, resets_at timestamptz, entry_limit integer, voice_limit integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_signup timestamptz;
  v_bonus_end timestamptz;
  v_week_start timestamptz;
BEGIN
  SELECT u.created_at INTO v_signup FROM auth.users u WHERE u.id = p_user_id;
  v_bonus_end := v_signup + interval '7 days';

  IF now() < v_bonus_end THEN
    RETURN QUERY SELECT v_signup, v_bonus_end, 15, 13;
    RETURN;
  END IF;

  /* Postgres weeks start on Monday, and Monday 00:00 UTC is the end of Sunday. */
  v_week_start := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  RETURN QUERY SELECT greatest(v_week_start, v_bonus_end), v_week_start + interval '7 days', 5, 3;
END;
$$;

/*
  True if Nova may work on this entry. The first time an entry uses Nova it takes
  one of the week's voice entries. After that, redos on the same entry are free
  and only the per-account daily limit in process-voice-journal applies.
*/
CREATE OR REPLACE FUNCTION public.claim_free_voice_entry(p_user_id uuid, p_ref text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_window record;
  v_used integer;
BEGIN
  /* One Nova call sets off two requests at once; the second must not slip past the count. */
  PERFORM pg_advisory_xact_lock(hashtextextended('free_plan:' || p_user_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.free_plan_usage
    WHERE user_id = p_user_id AND kind = 'voice' AND ref = p_ref
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_window FROM public.free_plan_window(p_user_id);

  SELECT count(*) INTO v_used FROM public.free_plan_usage
  WHERE user_id = p_user_id AND kind = 'voice' AND created_at >= v_window.window_start;

  IF v_used >= v_window.voice_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.free_plan_usage (user_id, kind, ref) VALUES (p_user_id, 'voice', p_ref);
  RETURN true;
END;
$$;

/* To attach: BEFORE INSERT ON journal_entries FOR EACH ROW. */
CREATE OR REPLACE FUNCTION public.free_plan_enforce_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_window record;
  v_used integer;
BEGIN
  /* Sample rows from the product tour are not the trader's own entries. */
  IF NEW.is_tour_demo OR public.free_plan_user_is_paid(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('free_plan:' || NEW.user_id::text, 0));

  SELECT * INTO v_window FROM public.free_plan_window(NEW.user_id);

  SELECT count(*) INTO v_used FROM public.free_plan_usage
  WHERE user_id = NEW.user_id AND kind = 'entry' AND created_at >= v_window.window_start;

  IF v_used >= v_window.entry_limit THEN
    RAISE EXCEPTION 'free_plan_entry_limit';
  END IF;

  INSERT INTO public.free_plan_usage (user_id, kind, ref)
  VALUES (NEW.user_id, 'entry', NEW.id::text)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

/* To attach: BEFORE INSERT OR UPDATE OF before_screenshots, after_screenshots ON journal_entries FOR EACH ROW. */
CREATE OR REPLACE FUNCTION public.free_plan_enforce_screenshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_new integer;
  v_old integer := 0;
BEGIN
  v_new := CASE WHEN jsonb_typeof(NEW.before_screenshots) = 'array' THEN jsonb_array_length(NEW.before_screenshots) ELSE 0 END
         + CASE WHEN jsonb_typeof(NEW.after_screenshots) = 'array' THEN jsonb_array_length(NEW.after_screenshots) ELSE 0 END;

  IF v_new <= 2 OR public.free_plan_user_is_paid(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := CASE WHEN jsonb_typeof(OLD.before_screenshots) = 'array' THEN jsonb_array_length(OLD.before_screenshots) ELSE 0 END
           + CASE WHEN jsonb_typeof(OLD.after_screenshots) = 'array' THEN jsonb_array_length(OLD.after_screenshots) ELSE 0 END;
  END IF;

  /* Someone who used to pay can keep editing an entry that already has more; they just can't add to it. */
  IF v_new > v_old THEN
    RAISE EXCEPTION 'free_plan_screenshot_limit';
  END IF;

  RETURN NEW;
END;
$$;

/* To attach: BEFORE INSERT ON broker_connections FOR EACH ROW. */
CREATE OR REPLACE FUNCTION public.free_plan_enforce_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.free_plan_user_is_paid(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('free_plan:' || NEW.user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.broker_connections b WHERE b.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'free_plan_account_limit';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.free_plan_user_is_paid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.free_plan_window(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_free_voice_entry(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.free_plan_enforce_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.free_plan_enforce_screenshots() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.free_plan_enforce_account() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_free_voice_entry(uuid, text) TO service_role;
