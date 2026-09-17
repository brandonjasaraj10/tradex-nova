/*
  Tell apart "they quit" from "we dropped them for not paying".

  Stripe calls both of these `canceled`, and the paywall could not see the
  difference. The rule granting access while current_period_end is still in
  the future exists for the first case and is right there: somebody who paid
  for a month and cancelled on day ten is owed the rest of that month.

  Applied to the second case it is backwards. When Stripe exhausts its
  retries on a failed card it cancels the subscription, and current_period_end
  is the end of a period the customer never paid for. On an annual plan that
  is a year. Seventeen subscriptions are sitting in past_due right now,
  correctly locked out - ten of them annual, running to September 2027 - and
  every one would have been let back in the moment Stripe finished retrying.

  So the reason is recorded, and only a voluntary cancellation keeps the
  wind-down.

  cancellation_reason holds Stripe's own value from
  subscription.cancellation_details.reason: cancellation_requested,
  payment_failed, or payment_disputed. Null means we do not know, which is
  true of every row written before this column existed.

  Null grants access, deliberately. The alternative - treating unknown as
  non-payment - would cut off anybody whose cancellation predates this
  change, and getting that wrong locks a paying customer out of a product
  they paid for. Exactly one live row is affected either way, and being
  generous with that one is the cheaper mistake.
*/

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN subscriptions.cancellation_reason IS
  'Stripe cancellation_details.reason: cancellation_requested / payment_failed / payment_disputed. Null for rows predating this column. Only a non-payment reason removes the paid-through wind-down.';

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          s.status IN ('active', 'trialing')
          OR (
            s.status = 'canceled'
            AND s.current_period_end > now()
            /*
              The wind-down, for people who paid and then left. A
              cancellation Stripe made because the money never arrived does
              not buy the period it ends in.
            */
            AND coalesce(s.cancellation_reason, '') NOT IN ('payment_failed', 'payment_disputed')
          )
        )
    );
$$;
