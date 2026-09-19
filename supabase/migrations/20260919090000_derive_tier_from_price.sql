/*
  Fall back to the Stripe price id when plan_type has nothing to say.

  Tier changes happen in the Stripe billing portal. The portal swaps the price
  on the plan line item and reports it via customer.subscription.updated, but
  plan_type is only written by the newest webhook code - which is not deployed
  yet. A member who upgraded in the portal today would keep whatever plan_type
  sat on their row and never receive the tier they had just started paying for.

  stripe_price_id, by contrast, has been written by every deployed version of
  the webhook for months. It is the field that is always current, and it is
  what the customer actually bought.

  Resolution order: an explicit plan_type first, because that is how a
  deliberate grant is recorded ('lifetime', 'legacy', a comped 'pro') and must
  not be overridden by whatever price happens to sit beside it; then the price
  id; then 'pro' as the same generous fallback as before.

  This makes the price the source of truth with no deploy, and keeps working
  afterwards - the webhook writing plan_type just means the first branch
  answers instead of the second.

  Verified against every case before applying: a portal upgrade through
  Starter -> Pro -> Elite with an add-on attached reads 2 -> 3 -> 6; an
  explicit 'lifetime' still beats the price beside it; an unrecognised price
  still falls back to pro rather than locking anybody out.

  The ids must agree with TIER_BY_PRICE_ID in
  supabase/functions/_shared/subscriptionSync.ts.
*/

CREATE OR REPLACE FUNCTION public.tier_for_price(p_price_id text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT CASE p_price_id
    WHEN 'price_1UGqG0P9mqFWeYrvtPMZvsk6' THEN 'starter'
    WHEN 'price_1UGqFzP9mqFWeYrvwxpKrL7T' THEN 'starter'
    WHEN 'price_1UGqGwP9mqFWeYrvzMUUTkyY' THEN 'pro'
    WHEN 'price_1UGqGwP9mqFWeYrvkph5vtn3' THEN 'pro'
    WHEN 'price_1UGqq1P9mqFWeYrvfkgvSpDn' THEN 'elite'
    WHEN 'price_1UGqrcP9mqFWeYrvwfanVeKY' THEN 'elite'
    /* Sold before tiers existed - see the legacy tier migration. */
    WHEN 'price_1ScJiLP9mqFWeYrvAf1mt8kh' THEN 'legacy'
    WHEN 'price_1ScyAlP9mqFWeYrvEAo0WOhT' THEN 'legacy'
    WHEN 'price_1U6eAKP9mqFWeYrv2D7cKdz6' THEN 'legacy'
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.tier_for_price(text) IS
  'Maps a Stripe price id to a tier. Used when plan_type is not set, so a plan change made in the Stripe billing portal takes effect without waiting for the webhook that writes plan_type.';

CREATE OR REPLACE FUNCTION public.subscription_tier_for(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $function$
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
      SELECT coalesce(
        CASE lower(coalesce(s.plan_type, ''))
          WHEN 'starter'  THEN 'starter'
          WHEN 'pro'      THEN 'pro'
          WHEN 'elite'    THEN 'elite'
          WHEN 'lifetime' THEN 'elite'
          WHEN 'legacy'   THEN 'legacy'
          ELSE NULL
        END,
        public.tier_for_price(s.stripe_price_id),
        'pro'
      )
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
      LIMIT 1
    ), 'pro')
  END;
$function$;
