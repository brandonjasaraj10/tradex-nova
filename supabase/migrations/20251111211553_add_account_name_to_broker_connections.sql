/*
  # Add account name to broker connections

  1. Changes
    - Add `account_name` column to `broker_connections` table
      - Allows users to give custom names to their connected accounts
      - Defaults to broker type if not provided
    - Add `is_active` column to track which account is currently selected
      - Only one account can be active at a time per user
    - Add index on user_id and is_active for faster queries

  2. Security
    - No RLS changes needed (existing policies cover new columns)
*/

-- Add account_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN account_name text;
  END IF;
END $$;

-- Add is_active column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN is_active boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_active 
ON broker_connections(user_id, is_active);

-- Create function to ensure only one active account per user
CREATE OR REPLACE FUNCTION ensure_single_active_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE broker_connections
    SET is_active = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_active_account ON broker_connections;
CREATE TRIGGER trigger_ensure_single_active_account
  BEFORE INSERT OR UPDATE ON broker_connections
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_account();