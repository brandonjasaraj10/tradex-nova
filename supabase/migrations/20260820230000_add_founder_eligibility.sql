/*
  Founder pricing eligibility: is the signed-in user on the waitlist?

  The landing page promises $14.99/mo locked in for people who join the
  waitlist before launch. That promise cannot be enforced in the browser -
  the founder price id ships inside the site's JavaScript, so anyone could
  call create-subscription with it directly and grant themselves the
  discount forever. Same shape as the "Activate Subscription (Testing)"
  hole removed in fix #3.

  This is the single source of truth, used by BOTH:
    - create-subscription, to refuse a founder price to a non-member
    - the Payment page, to decide which price to display

  so display and enforcement can't drift apart.

  SECURITY DEFINER because the waitlist deliberately has no public SELECT
  policy (fix #7 - it was leaking every collected email). The email comes
  from auth.jwt(), which is signed by Supabase and cannot be forged by the
  caller, so a user can only ever test their own address. The function
  returns a bare boolean and never exposes any other person's row.

  Note for launch: this makes anyone on the waitlist eligible, with no
  cutoff date. "Founder pricing ends the day we launch" is enforced by
  retiring the founder prices at launch, which is a deliberate step - not
  something that expires on its own.
*/

CREATE OR REPLACE FUNCTION public.is_founder_eligible()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.waitlist w
    WHERE lower(w.email) = lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''))
  );
$$;

-- Only signed-in users may ask, and only ever about themselves.
REVOKE ALL ON FUNCTION public.is_founder_eligible() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_founder_eligible() TO authenticated;
