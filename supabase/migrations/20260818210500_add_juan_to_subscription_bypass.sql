/*
  Add rodriguezjuanjmrg@gmail.com (Brandon's friend Juan, signed up
  2026-08-18) to the same hardcoded free-access bypass in
  has_active_subscription() that Brandon's own accounts already use
  (see 20260813211517_require_active_subscription_on_paid_tables.sql).
  This is a comped account, not a real Stripe subscription - no
  subscriptions row is created, same as the existing bypass entries.
*/

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          s.status IN ('active', 'trialing')
          OR (s.status = 'canceled' AND s.current_period_end > now())
          OR (s.status = 'past_due' AND s.grace_period_end > now())
        )
    );
$$;
