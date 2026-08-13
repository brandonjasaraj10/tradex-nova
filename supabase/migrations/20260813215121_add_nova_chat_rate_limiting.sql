/*
  # Rate limiting and daily quota for nova-chat

  ## Problem
  nova-chat had no rate limiting and no real authentication - it trusted
  a client-supplied user_id from the request body instead of verifying
  the caller's login token. Anyone could hit it directly (with any
  user_id, real or made up) and run up the Anthropic bill with no limit.

  ## Fix
  This table plus function give the edge function a way to atomically
  check-and-increment two counters per user: a short burst window (per
  minute) and a daily total. The row lock (SELECT ... FOR UPDATE) makes
  concurrent requests from the same user serialize correctly instead of
  a race letting both slip through under the limit.

  This migration only adds the mechanism. The actual limit values and
  the switch to deriving the caller's identity from their verified JWT
  (instead of the request body) live in the edge function itself.
*/

CREATE TABLE IF NOT EXISTS nova_chat_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_window_start timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0,
  usage_day date NOT NULL DEFAULT CURRENT_DATE,
  day_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nova_chat_rate_limits ENABLE ROW LEVEL SECURITY;

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
BEGIN
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

  IF v_row.day_count >= p_daily_limit THEN
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
