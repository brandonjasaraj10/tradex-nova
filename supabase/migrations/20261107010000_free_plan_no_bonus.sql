/*
  No first-week bonus: 5 entries and 3 Nova voice entries a week from day one.
  The research found nothing behind a temporary extra allowance, and the first
  pattern now comes at 5 entries, which fits in one week.

  Still inert: nothing uses these limits until the free plan is switched on.
*/
CREATE OR REPLACE FUNCTION public.free_plan_window(p_user_id uuid)
RETURNS TABLE (window_start timestamptz, resets_at timestamptz, entry_limit integer, voice_limit integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_week_start timestamptz;
BEGIN
  /* Postgres weeks start on Monday, and Monday 00:00 UTC is the end of Sunday. */
  v_week_start := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  RETURN QUERY SELECT v_week_start, v_week_start + interval '7 days', 5, 3;
END;
$$;

REVOKE ALL ON FUNCTION public.free_plan_window(uuid) FROM PUBLIC, anon, authenticated;
