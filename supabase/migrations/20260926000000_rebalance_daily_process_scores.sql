/*
  Make the process grid mean something, and count the psychology checklist.

  TWO PROBLEMS WITH THE OLD SCORE.

  First, journalling at all was worth a flat 100. That term sat in the
  numerator unconditionally, so a day with no rules and no confluences
  attached scored 100/1 - a perfect day for opening the app and typing. On
  the real data that was not an edge case: 83.5% of all entries have neither
  attached, and 139 of 154 scored days came back in the top band. The grid
  was a binary - dark if you journalled, empty if you did not - wearing four
  shades it never used.

  Second, the pre-trade psychology checklist was not counted at all, despite
  being exactly the same kind of evidence as a followed rule: something the
  trader committed to and either did or did not do.

  HOW IT SCORES NOW.

  Three gradeable parts, each the share of things the trader actually did:
  rules followed, confluences against their own minimum, psychology checks
  confirmed. The score is the average of the parts that APPLY, so somebody
  who keeps rules but no confluences is still marked out of 100 rather than
  penalised for a feature they do not use.

  Journalling is no longer a part. It is the entry ticket - it decides
  whether the day is drawn at all - and a day with nothing to grade scores
  BASE, which reads as "you showed up" rather than as a perfect day.

  THE FLOOR IS THE IMPORTANT BIT.

  A graded day can never score below BASE either. Without that, a trader who
  honestly ticks a rule as broken scores worse than one who does not tick
  anything - which teaches people to stop recording their misses, on the one
  screen whose whole purpose is recording them. Engaging with the checklist
  can now only help or tie, never hurt.

  Expect the picture to change. Most days will sit at BASE until people
  start using the checklists, because most days genuinely have nothing to
  grade. That is the honest version of what the old score was hiding, and it
  is what gives the darker squares something to mean.
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
  WITH base AS (SELECT 60::numeric AS v),
  days AS (
    SELECT e.entry_date::date AS day, e.id AS entry_id
    FROM journal_entries e
    WHERE e.user_id = p_user_id
      AND e.entry_date >= p_from
      AND e.entry_date <= p_to
      /* NULL account means every account, which is the default view. */
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
  /*
    The pre-trade checklist, counted the same way as the rules it sits
    beside. A check the trader confirmed is a thing they said they would do
    and did.
  */
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
    FROM trading_plan_settings s
    WHERE s.user_id = p_user_id
  ),
  per_day AS (
    SELECT
      d.day,
      count(DISTINCT d.entry_id)::integer AS entries,
      CASE WHEN rp.total > 0 THEN 100.0 * rp.good / rp.total END AS r_ratio,
      /*
        Confluences are judged against the trader's own minimum rather than
        against how many they happened to tick - meeting the bar you set is
        the whole point, and exceeding it is not extra credit.
      */
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
