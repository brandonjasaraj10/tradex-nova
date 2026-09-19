/*
  How many trading accounts a subscriber may have connected at once.

  This is a cost control before it is a product rule. Every connected
  account is billed to us by MetaApi for as long as it exists - roughly $9 a
  month running, or $0.77 stopped - so without a cap one subscriber on a $25
  plan could connect a dozen accounts and cost more than they pay.

  One function rather than a number written into the connect endpoint, so
  the frontend can show "1 of 2 used" from the same source that enforces it.
  A limit the UI disagrees with is worse than no limit: the trader fills in
  their password, presses Connect, and only then finds out.

  Every current plan gets 2. The two sync tiers that have been discussed -
  a continuous one around $49.99 and the existing plan around $27.99 with a
  daily sync - both allow 2 as well, so today there is nothing to
  distinguish. When a tier needs a different number, add its price id to the
  CASE below; that is the only place that has to change.

  Admins get 10 so this can be tested with more than two accounts without
  anybody editing the rule to do it.
*/
CREATE OR REPLACE FUNCTION public.synced_account_limit()
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    THEN 10
    ELSE coalesce((
      /*
        Two for every plan that exists today. When a sync tier needs a
        different number this becomes
          CASE WHEN s.stripe_price_id = 'price_...' THEN 5 ELSE 2 END
        and this is the only place that has to change. The subscription is
        still joined even though nothing reads it yet - it is what makes the
        limit 0 for somebody without a live one.
      */
      SELECT 2
      FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          s.status IN ('active', 'trialing')
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
      LIMIT 1
    ), 0)
  END;
$function$;

COMMENT ON FUNCTION public.synced_account_limit() IS
  'Connected-account cap for the calling user. 0 when there is no live subscription - a lapsed subscriber connects nothing new.';
