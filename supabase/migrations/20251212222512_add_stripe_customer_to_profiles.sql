/*
  # Add Stripe Customer ID to User Profiles

  1. Changes
    - Add `stripe_customer_id` column to `user_profiles` table
    - This allows us to track the Stripe customer ID at the user level
    - Needed for billing portal and subscription management
  
  2. Notes
    - Column is nullable since not all users may have Stripe customers yet
    - Unique constraint ensures one customer ID per user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text UNIQUE;
  END IF;
END $$;
