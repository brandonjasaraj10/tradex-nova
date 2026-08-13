/*
  # Add preference columns to user_profiles

  1. Modified Tables
    - `user_profiles`
      - `timezone` (text, default 'UTC') - user's preferred timezone
      - `currency` (text, default 'USD') - user's preferred currency
      - `date_format` (text, default 'MM/DD/YYYY') - user's preferred date format

  2. Important Notes
    - These columns are queried by the preferences context on every page load
    - Missing columns were causing 400 errors from Supabase
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN timezone text DEFAULT 'UTC';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'currency'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN currency text DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'date_format'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN date_format text DEFAULT 'MM/DD/YYYY';
  END IF;
END $$;