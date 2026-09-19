/*
  Give every existing subscription an explicit tier, and grandfather the
  members who joined before tiers existed.

  plan_type has been null on every Stripe-created row since the table existed,
  because nothing ever wrote it - the webhook stored stripe_price_id and
  stopped. subscription_tier_for() treats null as 'pro', which was invisible
  while there was one plan and one allowance: the fallback happened to be
  right for everybody.

  Tiers end that. A null plan_type now hands out Pro's allowance - two synced
  accounts, 100 Nova questions a day - to whoever holds a subscription row,
  whatever they paid. At roughly $8.64 a month of MetaApi hosting per synced
  account, the second one is a real bill against revenue never charged for it.

  ---------------------------------------------------------------------------
  The 'legacy' tier

  The three live paying members are all on the $24.99 monthly price, below
  Starter's $29.99, and were promised in writing - twice on the pricing page -
  that the rate they joined at is the rate they keep and that nothing they
  already have is moving behind a higher tier.

  Mapping them straight onto Starter keeps the first half of that promise and
  breaks the second: Starter allows 25 Nova questions a day and they have had
  100 since the quota was introduced. None of the three has ever sent a single
  Nova message, so nobody would have noticed - but "nobody noticed" is not the
  same as "we kept our word", and the cost of keeping it is zero.

  So they get their own tier. It is Starter in every way that costs money -
  one synced account, because broker sync did not exist when they subscribed
  and one is what their price supports - and Pro in the one way that was
  already theirs.

  Deliberately a tier rather than a per-user exception: the rule is "joined
  before tiers", which is a class of customer, not three user ids. Anyone who
  subscribes on an old price link tomorrow lands in the same place without
  anybody remembering to add them.

  Nobody needs to do anything, nothing changes in Stripe, and nobody is
  emailed about it.
*/

/* ---------------------------------------------------------------------------
   1. Teach the tier resolver about 'legacy'.
--------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.subscription_tier_for(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
        WHEN 'legacy'   THEN 'legacy'
        ELSE 'pro'
      END
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
      LIMIT 1
    ), 'pro')
  END;
$function$;

/* ---------------------------------------------------------------------------
   2. Give every limit function a 'legacy' arm.

   All four are rewritten rather than patched, so each one states the whole
   table of allowances in a single place and a future reader never has to
   reconstruct it from a diff. The numbers for starter/pro/elite are unchanged.
--------------------------------------------------------------------------- */

/* Starter's one account: what $24.99 supports at $8.64 of hosting apiece. */
CREATE OR REPLACE FUNCTION public.synced_account_limit_for(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 10
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'legacy'  THEN 1
      WHEN 'starter' THEN 1
      WHEN 'pro'     THEN 2
      WHEN 'elite'   THEN 5
      ELSE 0
    END
  END;
$function$;

/* Pro's 100: the allowance these members already had, kept. */
CREATE OR REPLACE FUNCTION public.nova_daily_limit(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 1000
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'legacy'  THEN 100
      WHEN 'starter' THEN 25
      WHEN 'pro'     THEN 100
      WHEN 'elite'   THEN 300
      ELSE NULL
    END
  END;
$function$;

CREATE OR REPLACE FUNCTION public.parked_account_limit_for(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 30
    ELSE CASE public.subscription_tier_for(p_user_id)
      WHEN 'legacy'  THEN 3
      WHEN 'starter' THEN 3
      WHEN 'pro'     THEN 6
      WHEN 'elite'   THEN 15
      ELSE 0
    END
  END;
$function$;

CREATE OR REPLACE FUNCTION public.synced_account_month_limit()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 20
    ELSE CASE public.subscription_tier()
      WHEN 'legacy'  THEN 2
      WHEN 'starter' THEN 2
      WHEN 'pro'     THEN 3
      WHEN 'elite'   THEN 10
      ELSE 0
    END
  END;
$function$;

/* ---------------------------------------------------------------------------
   3. Fill in the rows that already exist.

   Same mapping the webhook now applies going forward
   (_shared/subscriptionSync.ts). Both exist on purpose: this fixes today's
   rows, the webhook keeps every row created after it correct without another
   migration.
--------------------------------------------------------------------------- */

UPDATE subscriptions SET plan_type = 'legacy'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1ScJiLP9mqFWeYrvAf1mt8kh',  /* $24.99 monthly - the live members */
    'price_1ScyAlP9mqFWeYrvEAo0WOhT',  /* $249.90 annual                    */
    'price_1U6eAKP9mqFWeYrv2D7cKdz6'   /* $14.99 founder                    */
  );

UPDATE subscriptions SET plan_type = 'starter'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1UGqG0P9mqFWeYrvtPMZvsk6',
    'price_1UGqFzP9mqFWeYrvwxpKrL7T'
  );

UPDATE subscriptions SET plan_type = 'pro'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1UGqGwP9mqFWeYrvzMUUTkyY',
    'price_1UGqGwP9mqFWeYrvkph5vtn3'
  );

UPDATE subscriptions SET plan_type = 'elite'
WHERE plan_type IS NULL
  AND stripe_price_id IN (
    'price_1UGqq1P9mqFWeYrvfkgvSpDn',
    'price_1UGqrcP9mqFWeYrvwfanVeKY'
  );

/*
  Rows with no Stripe price at all are the comped and manually-inserted ones -
  test accounts and the few people given access by hand. They keep the 'pro'
  they already carry: there is no price to read, and no reason to change what
  somebody was deliberately granted.

  Any price id not listed above is left alone on purpose. Those rows keep
  plan_type null and go on getting subscription_tier_for()'s 'pro' fallback,
  which is the generous answer. A price this migration has not heard of is
  almost certainly one nobody has mapped yet, and demoting a paying customer
  over our own bookkeeping gap is the worse of the two mistakes.
*/
