/*
  # Fix user_profiles RLS policies to check user_id, not id

  ## Problem
  On this database, user_profiles.id is an auto-generated internal
  primary key (default gen_random_uuid()) and the actual link to the
  authenticated user is the separate user_id column (unique, foreign
  key to auth.users). The three existing RLS policies still checked
  `id = auth.uid()`, which no longer matches anything - id is a random
  value, not the user's auth id. This silently broke every profile
  read/write: new signups could not create a profile row at all
  ("new row violates row-level security policy for table
  user_profiles"), and even if a row existed, no user could read or
  update their own profile.

  ## Fix
  Recreate all three policies to check user_id = auth.uid() instead.
*/

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
