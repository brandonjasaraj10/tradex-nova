/*
  # Fix waitlist RLS policies

  1. Changes
    - Drop existing INSERT policy that only targets `anon` role
    - Drop existing SELECT policy that only targets `anon` role
    - Recreate INSERT policy targeting both `anon` and `authenticated` roles
    - Recreate SELECT policy targeting both `anon` and `authenticated` roles

  2. Reason
    - Users visiting the sales/landing page while logged in could not submit
      their email because the INSERT policy only allowed the `anon` role
    - This caused silent failures when authenticated users tried to join the waitlist
*/

DROP POLICY IF EXISTS "Anyone can insert emails" ON waitlist;
DROP POLICY IF EXISTS "Emails are publicly readable" ON waitlist;

CREATE POLICY "Anyone can insert emails"
  ON waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Emails are publicly readable"
  ON waitlist
  FOR SELECT
  TO anon, authenticated
  USING (true);
