/*
  Stop daily_process_scores answering for anybody but the caller.

  The function is SECURITY DEFINER, so it runs with the owner's rights and
  RLS does not apply to the tables it reads. It took the user to report on
  as a PARAMETER and never checked it against the session - and EXECUTE was
  granted to anon. So an unauthenticated request carrying the anon key,
  which ships in the frontend bundle, could pass any user id and get that
  person's journalling history back: which days they journalled, how many
  entries each day, and their process score.

  Verified against a real account before fixing, as an anonymous caller.

  This is the same shape as the log-journal-entry hole from the original
  audit - identity taken from the request body rather than from the verified
  session - and it predates the rebalance, though the rebalance rewrote the
  function without catching it.

  p_user_id is kept in the signature so the client does not change, but it
  is no longer trusted: auth.uid() decides whose rows are read, and a
  request for anybody else now returns exactly nothing. EXECUTE is revoked
  from anon as well, because there is no signed-out use for this at all -
  defence in depth rather than the guard alone.
*/

CREATE OR REPLACE FUNCTION public.daily_process_scores(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_account_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(day date, score integer, journalled boolean, entries integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH caller AS (
    /*
      The only identity this function will answer for. p_user_id is accepted
      for call-site compatibility and deliberately ignored: reading it would
      be trusting a value the caller chose.
    */
    SELECT auth.uid() AS uid
  ),
  base AS (SELECT 60::numeric AS v),
  days AS (
    SELECT e.entry_date::date AS day, e.id AS entry_id
    FROM journal_entries e, caller c
    WHERE c.uid IS NOT NULL
      AND e.user_id = c.uid
      AND e.entry_date >= p_from
      AND e.entry_date <= p_to
      AND (p_account_id IS NULL OR e.account_id = p_account_id)
  ),
  rule_part AS (
    SELECT d.day,
           count(*) FILTER (WHERE r.followed) AS good,
           count(*)                           AS total
    FROM days d
    JOIN journal_entry_rules r ON r.journal_entry_id = d.entry_id
    GROUP BY d.day
  ),
  conf_part AS (
    SELECT d.day,
           count(*) FILTER (WHERE c.present) AS good,
           count(*)                          AS total
    FROM days d
    JOIN journal_entry_confluences c ON c.journal_entry_id = d.entry_id
    GROUP BY d.day
  ),
  psy_part AS (
    SELECT d.day,
           count(*) FILTER (WHERE p.confirmed) AS good,
           count(*)                            AS total
    FROM days d
    JOIN journal_entry_psychology_checks p ON p.journal_entry_id = d.entry_id
    GROUP BY d.day
  ),
  required AS (
    SELECT coalesce(max(s.min_confluences_required), 0) AS min_required
    FROM trading_plan_settings s, caller c
    WHERE s.user_id = c.uid
  ),
  per_day AS (
    SELECT
      d.day,
      count(DISTINCT d.entry_id)::integer AS entries,
      CASE WHEN rp.total > 0 THEN 100.0 * rp.good / rp.total END AS r_ratio,
      CASE WHEN cp.total > 0 THEN
        CASE WHEN cp.good >= (SELECT min_required FROM required) THEN 100.0
             ELSE 100.0 * cp.good / GREATEST((SELECT min_required FROM required), 1) END
      END AS c_ratio,
      CASE WHEN pp.total > 0 THEN 100.0 * pp.good / pp.total END AS p_ratio
    FROM days d
    LEFT JOIN rule_part rp ON rp.day = d.day
    LEFT JOIN conf_part cp ON cp.day = d.day
    LEFT JOIN psy_part  pp ON pp.day = d.day
    GROUP BY d.day, rp.total, rp.good, cp.total, cp.good, pp.total, pp.good
  )
  SELECT
    pd.day,
    CASE
      WHEN (SELECT count(*) FROM (VALUES (pd.r_ratio), (pd.c_ratio), (pd.p_ratio)) v(x)
            WHERE v.x IS NOT NULL) = 0
        THEN (SELECT v FROM base)::integer
      ELSE GREATEST(
        (SELECT v FROM base),
        round((SELECT avg(v.x) FROM (VALUES (pd.r_ratio), (pd.c_ratio), (pd.p_ratio)) v(x)
               WHERE v.x IS NOT NULL))
      )::integer
    END AS score,
    true AS journalled,
    pd.entries
  FROM per_day pd
  ORDER BY pd.day;
$function$;

/* No signed-out caller has any use for this. */
REVOKE EXECUTE ON FUNCTION public.daily_process_scores(uuid, date, date, uuid) FROM anon;
