/*
  Give founder pricing a real deadline.

  Until now is_founder_eligible() only asked "is this email on the waitlist",
  with no time limit - so the discount would have stayed claimable forever
  and the launch email's "this isn't available after launch" line would have
  been false. Waitlist members now have a window: the app opens Sun 23 Aug
  2026 at 10:00 PM MDT and founder pricing closes 2 days later, Tue 25 Aug
  at 10:00 PM MDT. After that they pay standard price like everyone else.

  Stored as a UTC timestamp (MDT is UTC-6 in August) because now() is UTC;
  comparing against a local-looking literal is how you end up closing the
  offer six hours early.

  This is the enforcement, not the display. create-subscription calls this
  before asking Stripe for a founder price, so the deadline holds even for
  someone calling the API directly with the price id lifted out of the
  frontend bundle - the same reason the waitlist check lives here rather
  than in the browser.
*/

CREATE OR REPLACE FUNCTION public.is_founder_eligible()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    now() < timestamptz '2026-08-26 04:00:00+00'
    AND EXISTS (
      SELECT 1
      FROM public.waitlist w
      WHERE lower(w.email) = lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''))
    );
$$;

REVOKE ALL ON FUNCTION public.is_founder_eligible() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_founder_eligible() TO authenticated;
