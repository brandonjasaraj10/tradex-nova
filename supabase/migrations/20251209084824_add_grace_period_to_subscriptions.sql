/*
  # Add Grace Period Support for Failed Payments

  ## Overview
  Adds grace period tracking to subscriptions table to handle failed payments gracefully.
  Users with failed payments will have a 7-day grace period to update their payment method
  before losing access to the platform.

  ## Changes
  1. Add `grace_period_end` column to track when grace period expires
  2. Users in past_due status with grace_period_end in the future retain access
  3. After grace period expires, access is restricted until payment is successful

  ## Access Rules After This Migration
  - Active/Trialing status → Full access
  - Canceled with future period_end → Access until period ends
  - Past_due within grace period → Full access
  - Past_due after grace period → No access (redirect to payment)
  - Canceled/Unpaid/Incomplete → No access
*/

-- Add grace_period_end column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'grace_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN grace_period_end timestamptz;
  END IF;
END $$;

-- Add comment explaining the grace period
COMMENT ON COLUMN subscriptions.grace_period_end IS 'When the grace period for failed payments expires. Users retain access during grace period.';