/*
  A daily ceiling on Nova entry calls across ALL accounts that have not paid.

  Each unpaid account is already capped at 10 a day, and signup now has bot
  protection, but neither bounds the total: a thousand accounts could still each
  spend their allowance. This is the backstop, one counter per UTC day.

  Called only by process-voice-journal, with the service role. Execute is
  deliberately not granted to signed-in users: anybody who could call this could
  run the day's budget out and stop every new user writing their first entry.

  No policies on the table on purpose: RLS on and no policy means no client can
  read or write it. Additive; nothing else reads it.
*/

CREATE TABLE IF NOT EXISTS public.unpaid_ai_daily_usage (
  usage_day date PRIMARY KEY,
  call_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.unpaid_ai_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_increment_unpaid_ai_budget(p_daily_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  /*
    One atomic statement, so two calls at the same moment cannot both take the
    last slot. At the limit the UPDATE matches nothing and no row comes back.
  */
  INSERT INTO public.unpaid_ai_daily_usage AS u (usage_day, call_count)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (usage_day) DO UPDATE
    SET call_count = u.call_count + 1
    WHERE u.call_count < p_daily_limit
  RETURNING u.call_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_unpaid_ai_budget(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_unpaid_ai_budget(integer) TO service_role;
