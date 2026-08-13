/*
  # Add Password Reset Codes and Tour Tracking

  1. New Tables
    - `password_reset_codes`
      - `id` (uuid, primary key)
      - `email` (text, not null) - User's email address
      - `code` (text, not null) - 6-digit verification code
      - `expires_at` (timestamptz, not null) - Code expiration time (15 minutes)
      - `used` (boolean, default false) - Whether code has been used
      - `attempts` (integer, default 0) - Number of verification attempts
      - `created_at` (timestamptz, default now())

  2. Modified Tables
    - `user_profiles`
      - Add `tour_completed` (boolean, default false) - Tracks if user has seen the onboarding tour
      - Add `terms_accepted_at` (timestamptz) - When user accepted terms of service

  3. Security
    - Enable RLS on `password_reset_codes` table
    - No direct user access to reset codes (handled via edge functions)
    - Codes are created and validated server-side only

  4. Functions
    - `cleanup_expired_reset_codes()` - Removes expired codes automatically
*/

-- Create password_reset_codes table
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable RLS on password_reset_codes
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- No direct user policies - all access through service role in edge functions

-- Add tour_completed column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'tour_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tour_completed boolean DEFAULT false;
  END IF;
END $$;

-- Add terms_accepted_at column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

-- Function to cleanup expired reset codes (can be called by a cron job or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < now() OR used = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;