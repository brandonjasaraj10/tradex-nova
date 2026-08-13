/*
  # Remove public read access to waitlist emails

  ## Problem
  The "Emails are publicly readable" policy allowed anyone (anon or
  authenticated, no login required) to read every collected waitlist
  email via `USING (true)`. This was live and exploitable - all
  waitlist emails could be dumped via the public REST API.

  ## Fix
  Drop the public SELECT policy entirely. The waitlist table has no
  user_id/owner column (signups happen before an account exists), so
  there is no "own row" concept to scope a SELECT policy to - the
  correct behavior is that nobody except the service role (backend)
  can read the list. The public INSERT policy is untouched, so the
  signup form keeps working; it never used `.select()` after insert,
  so removing SELECT access does not break it.
*/

DROP POLICY IF EXISTS "Emails are publicly readable" ON waitlist;
