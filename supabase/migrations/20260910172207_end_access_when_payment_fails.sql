/*
  A failed payment now ends access immediately.

  Two halves, and both are needed:

  1. has_active_subscription() stops honouring grace_period_end. This is the
     rule every RLS policy on every paid table actually consults, so it is
     what makes the change real rather than cosmetic - the frontend check is
     a convenience, this is the enforcement.

  2. Existing deadlines are cleared. Seven accounts were inside a grace
     period when this changed, and leaving their dates in place would have
     been harmless only because the clause above is gone; clearing them
     removes the ambiguity entirely rather than relying on that.

  This is a deliberate cut-off, decided knowing those seven had already been
  emailed a date of 17 September. They lose access now instead.

  'trialing' is untouched. Trials are no longer offered to new users, but 25
  people are inside one and they keep it until it expires on its own.
*/

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT
    auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          s.status IN ('active', 'trialing')
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    );
$function$;

UPDATE public.subscriptions
SET grace_period_end = NULL
WHERE grace_period_end IS NOT NULL;
