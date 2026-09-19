/*
  Give Nova's daily allowance the number the plan was sold on.

  The pricing page offers 25 questions a day on Starter, 100 on Pro and 300
  on Elite. nova-chat has always passed a flat DAILY_LIMIT of 100 for
  everybody, so Elite was sold 300 and given 100 - under-delivering on the
  most expensive plan - while Starter was given four times what it pays for,
  and Nova calls cost real money.

  Enforced here rather than in nova-chat because this function already
  receives the user and already decides the answer. Changing the constant in
  the edge function would work equally well and mean redeploying it; this
  way the allowance follows the subscription wherever it is read from.

  p_daily_limit is kept and still honoured as the ceiling for anyone with no
  resolvable tier, so an unsubscribed caller behaves exactly as before rather
  than silently getting zero from a function that used to allow a hundred.
*/

/*
  The tier logic, by explicit user id.

  subscription_tier() reads auth.uid(), which is null when a function runs
  under the service role - which is exactly how nova-chat calls in. So the
  real implementation takes the id, and the original becomes a thin wrapper
  so there is still only one copy of the rule.
*/
CREATE OR REPLACE FUNCTION public.subscription_tier_for(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN NULL
    WHEN NOT EXISTS (
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
    ) THEN NULL
    ELSE coalesce((
      SELECT CASE lower(coalesce(s.plan_type, ''))
        WHEN 'starter'  THEN 'starter'
        WHEN 'pro'      THEN 'pro'
        WHEN 'elite'    THEN 'elite'
        WHEN 'lifetime' THEN 'elite'
        ELSE 'pro'
      END
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
      LIMIT 1
    ), 'pro')
  END;
$$;

CREATE OR REPLACE FUNCTION public.subscription_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.subscription_tier_for(auth.uid());
$$;

/*
  Null rather than a number when there is no tier, so the caller's own
  default still applies instead of this quietly deciding for it.
*/
CREATE OR REPLACE FUNCTION public.nova_daily_limit(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    /* Admins by id only - the email check needs a JWT this never has. */
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 1000
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'starter' THEN 25
      WHEN 'pro'     THEN 100
      WHEN 'elite'   THEN 300
      ELSE NULL
    END
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_increment_nova_usage(
  p_user_id uuid,
  p_per_minute_limit integer,
  p_daily_limit integer
)
RETURNS TABLE(allowed boolean, reason text, minute_count integer, day_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row nova_chat_rate_limits;
  v_daily_limit integer;
BEGIN
  /* The plan's number when there is one, the caller's otherwise. */
  v_daily_limit := coalesce(public.nova_daily_limit(p_user_id), p_daily_limit);

  INSERT INTO nova_chat_rate_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM nova_chat_rate_limits WHERE user_id = p_user_id FOR UPDATE;

  IF now() - v_row.minute_window_start > interval '1 minute' THEN
    v_row.minute_window_start := now();
    v_row.minute_count := 0;
  END IF;

  IF v_row.usage_day <> CURRENT_DATE THEN
    v_row.usage_day := CURRENT_DATE;
    v_row.day_count := 0;
  END IF;

  IF v_row.minute_count >= p_per_minute_limit THEN
    UPDATE nova_chat_rate_limits
    SET minute_window_start = v_row.minute_window_start,
        minute_count = v_row.minute_count,
        usage_day = v_row.usage_day,
        day_count = v_row.day_count,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT false, 'rate_limited'::text, v_row.minute_count, v_row.day_count;
    RETURN;
  END IF;

  IF v_row.day_count >= v_daily_limit THEN
    UPDATE nova_chat_rate_limits
    SET minute_window_start = v_row.minute_window_start,
        minute_count = v_row.minute_count,
        usage_day = v_row.usage_day,
        day_count = v_row.day_count,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT false, 'daily_limit'::text, v_row.minute_count, v_row.day_count;
    RETURN;
  END IF;

  v_row.minute_count := v_row.minute_count + 1;
  v_row.day_count := v_row.day_count + 1;

  UPDATE nova_chat_rate_limits
  SET minute_window_start = v_row.minute_window_start,
      minute_count = v_row.minute_count,
      usage_day = v_row.usage_day,
      day_count = v_row.day_count,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, NULL::text, v_row.minute_count, v_row.day_count;
END;
$$;
