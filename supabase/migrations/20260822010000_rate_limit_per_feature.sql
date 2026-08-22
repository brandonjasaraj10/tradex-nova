/*
  Give every paid-API endpoint its own rate limit bucket.

  Only nova-chat was metered. process-voice-journal (Claude) and nova-tts
  (OpenAI) were unlimited, so a single signed-in account running a loop -
  or a client with a retry bug - could bill roughly $3,500/day of API usage
  to the project with nothing to stop it.

  Buckets are keyed (user_id, feature) rather than a single shared counter.
  With one counter, a voice conversation would burn two units per exchange -
  one to think, one to speak - and voice users would hit the wall at half
  the conversation length while looking like a bug rather than a limit.

  Limits are set from measured cost per call, at roughly 8x observed heavy
  use, so a real user never meets the fence:

    chat            10/min  100/day  (unchanged)
    voice_journal   20/min  300/day  ~$0.023/call -> $6.75/day ceiling
    tts             15/min  150/day  ~$0.018/call -> $2.70/day ceiling

  tts is the tightest because it is the most expensive thing per month:
  speech is billed per character with no caching to soften it, unlike chat
  where a cached system prompt keeps 150 messages down to about $2.
*/

ALTER TABLE public.nova_chat_rate_limits
  ADD COLUMN IF NOT EXISTS feature text NOT NULL DEFAULT 'chat';

-- Re-key on (user_id, feature). Existing rows are all chat usage and keep
-- their counts through the default above.
ALTER TABLE public.nova_chat_rate_limits
  DROP CONSTRAINT IF EXISTS nova_chat_rate_limits_pkey;

ALTER TABLE public.nova_chat_rate_limits
  ADD CONSTRAINT nova_chat_rate_limits_pkey PRIMARY KEY (user_id, feature);

/*
  p_feature defaults to 'chat' so the existing nova-chat call site keeps
  working untouched - it passes three arguments and still resolves here.
*/
CREATE OR REPLACE FUNCTION public.check_and_increment_nova_usage(
  p_user_id uuid,
  p_per_minute_limit integer,
  p_daily_limit integer,
  p_feature text DEFAULT 'chat'
)
RETURNS TABLE(allowed boolean, reason text, minute_count integer, day_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row nova_chat_rate_limits;
BEGIN
  INSERT INTO nova_chat_rate_limits (user_id, feature)
  VALUES (p_user_id, p_feature)
  ON CONFLICT (user_id, feature) DO NOTHING;

  SELECT * INTO v_row
  FROM nova_chat_rate_limits
  WHERE user_id = p_user_id AND feature = p_feature
  FOR UPDATE;

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
    WHERE user_id = p_user_id AND feature = p_feature;
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
    WHERE user_id = p_user_id AND feature = p_feature;
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
  WHERE user_id = p_user_id AND feature = p_feature;

  RETURN QUERY SELECT true, NULL::text, v_row.minute_count, v_row.day_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_and_increment_nova_usage(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_nova_usage(uuid, integer, integer, text) TO authenticated;
