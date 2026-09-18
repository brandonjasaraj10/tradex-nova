/*
  Sync allowances by plan, instead of one number for everybody.

  Until now every subscriber got the same 2 synced accounts and 4 new
  accounts a month, whatever they paid. That made Elite meaningless and
  Starter unprofitable, because the thing being handed out is the one part
  of this product with a real marginal cost: a synced account is a hosted
  MetaTrader terminal at $8.64 a month plus $1.17 of MetaStats, and adding
  one costs $2.10 that is never refunded.

  The three limits map to the three ways that cost is incurred:

    synced_account_limit        - accounts running at once     ($9.81/mo each)
    synced_account_month_limit  - new accounts introduced       ($2.10 each)
    parked_account_limit        - switched-off accounts kept    ($0.73/mo each)

  Agreed allowances:

    Starter  $29.99    1 synced     2 new/month     3 parked
    Pro      $49.99    2 synced     3 new/month     6 parked
    Elite   $149.99    5 synced    10 new/month    15 parked

  Note what is NOT limited: accounts, journal entries, trades, screenshots,
  Nova. Storage costs about two hundredths of a cent per user per year, so
  metering it would police the wrong thing and generate support tickets over
  nothing. Only live syncing is scarce, because only live syncing is billed.
*/

/*
  One place that decides which plan somebody is on, so three limits cannot
  disagree about it.

  Returns null when there is no valid subscription, which collapses every
  allowance to zero without each function repeating the access rule.

  The access condition is deliberately identical to has_active_subscription(),
  including the part added tonight: a cancellation Stripe made because the
  card failed does not buy the period it ends in. The old copy of this logic
  in synced_account_limit() had drifted and would still have handed two sync
  slots to somebody dropped for non-payment.
*/
CREATE OR REPLACE FUNCTION public.subscription_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    /*
      Legacy and unknown plans read as pro on purpose.

      plan_type is unset on most existing rows, and the per-tier Stripe
      price ids do not exist yet. Defaulting to starter would quietly cut
      every current subscriber from two synced accounts to one - taking
      something away from people who are paying, to enforce a tier they were
      never sold. Pro is what they have today, so pro is what they keep.

      Once the six price ids exist, map stripe_price_id here and this
      fallback only covers genuinely old rows.
    */
    WHEN NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
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
        /* Bought the product outright - give them the top allowance. */
        WHEN 'lifetime' THEN 'elite'
        ELSE 'pro'
      END
      FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
      LIMIT 1
    ), 'pro')
  END;
$$;

COMMENT ON FUNCTION public.subscription_tier() IS
  'starter / pro / elite, or null when there is no valid subscription. Unknown plan_type reads as pro so existing subscribers are not silently downgraded.';

/* Admin accounts, kept in one list rather than repeated three times. */
CREATE OR REPLACE FUNCTION public.is_tradex_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (
      ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com']
    );
$$;

/* How many accounts may sync at once. The $9.81/month line. */
CREATE OR REPLACE FUNCTION public.synced_account_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 10
    ELSE CASE public.subscription_tier()
      WHEN 'starter' THEN 1
      WHEN 'pro'     THEN 2
      WHEN 'elite'   THEN 5
      ELSE 0
    END
  END;
$$;

/*
  How many NEW accounts may be introduced in a calendar month. The $2.10
  line, and the one that bounds a trader cycling through blown prop
  accounts. Reconnecting an account already used this month is free and does
  not count, because MetaApi charges per unique account per month.
*/
CREATE OR REPLACE FUNCTION public.synced_account_month_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 20
    ELSE CASE public.subscription_tier()
      WHEN 'starter' THEN 2
      WHEN 'pro'     THEN 3
      WHEN 'elite'   THEN 10
      ELSE 0
    END
  END;
$$;

/*
  How many switched-off accounts we keep warm. The $0.73/month line.

  Without a cap this is the one that leaks: removal parks an account so
  reconnecting is instant and free, and the 120-day retirement is the only
  thing removing them. A trader churning ten accounts a month would sit on
  forty parked accounts before the first one expired - $29 a month of
  nothing. Past the cap the oldest is released early; the user's trades are
  untouched either way, and reconnecting that one later simply costs the
  $2.10 again.
*/
CREATE OR REPLACE FUNCTION public.parked_account_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_tradex_admin() THEN 30
    ELSE CASE public.subscription_tier()
      WHEN 'starter' THEN 3
      WHEN 'pro'     THEN 6
      WHEN 'elite'   THEN 15
      ELSE 0
    END
  END;
$$;
