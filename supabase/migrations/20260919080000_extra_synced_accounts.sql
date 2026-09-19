/*
  Extra synced accounts, bought one at a time.

  The pricing page used to promise these at $19 each and nothing existed
  behind it - no Stripe price, no purchase flow, and synced_account_limit_for()
  capping hard at the tier's number. The claim was pulled rather than shipped.
  This is the other half: building the thing so the claim can go back.

  Why an add-on rather than pushing everyone up a tier: a synced account costs
  us about $8.64 a month in MetaApi hosting, which is a real per-unit cost, so
  a real per-unit price is the honest shape. Somebody on Pro who takes a third
  prop challenge needs one more account, not $50 more of Nova quota. Making
  them buy Elite to get it is the kind of packaging that reads as a penalty
  for growing.

  Stored here rather than counted from Stripe at read time because this is
  consulted on every connect attempt and by RLS - it has to be a column read,
  not an API call. The webhook keeps it true, the same way it keeps status and
  plan_type true.
*/

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS extra_synced_accounts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN subscriptions.extra_synced_accounts IS
  'How many additional synced accounts this subscription pays for beyond its tier, taken from the quantity on the add-on line item in Stripe. Written by _shared/subscriptionSync.ts on every sync; never set by a client.';

/*
  Guarded so a client cannot write itself more accounts.

  The subscriptions table already has no client-facing update policy, but this
  column decides how much money we spend on somebody's behalf, so it is worth
  being explicit rather than relying on a policy staying absent.
*/
ALTER TABLE subscriptions
  ADD CONSTRAINT extra_synced_accounts_sane
  CHECK (extra_synced_accounts >= 0 AND extra_synced_accounts <= 50);

/*
  The allowance becomes tier + extras.

  The zero case is deliberate and comes first: when the tier resolves to 0
  there is no active subscription, and extras must not be added to it. A
  lapsed subscriber with an add-on row still on file would otherwise keep a
  synced account we are paying for after they stopped paying us.
*/
CREATE OR REPLACE FUNCTION public.synced_account_limit_for(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 10
    ELSE (
      SELECT CASE
        WHEN base = 0 THEN 0
        ELSE base + coalesce((
          SELECT s.extra_synced_accounts
          FROM public.subscriptions s
          WHERE s.user_id = p_user_id
          LIMIT 1
        ), 0)
      END
      FROM (
        SELECT CASE public.subscription_tier_for(p_user_id)
          WHEN 'legacy'  THEN 1
          WHEN 'starter' THEN 1
          WHEN 'pro'     THEN 2
          WHEN 'elite'   THEN 5
          ELSE 0
        END AS base
      ) t
    )
  END;
$function$;

/*
  Parked accounts scale with the allowance too.

  Parking is how a removed account keeps its history without being deleted and
  re-bought, and the cap exists so undeployed accounts cannot pile up for free.
  Somebody paying for four synced accounts needs more room to park than the
  tier alone allows, or buying an add-on quietly makes removal worse for them.
  Three per allowed account is the ratio the tiers already use.
*/
CREATE OR REPLACE FUNCTION public.parked_account_limit_for(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT CASE
    WHEN p_user_id = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid THEN 30
    ELSE CASE
      WHEN public.subscription_tier_for(p_user_id) IS NULL THEN 0
      ELSE public.synced_account_limit_for(p_user_id) * 3
    END
  END;
$function$;
