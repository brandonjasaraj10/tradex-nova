/*
  # Add Account Type Support for Prop Firms

  1. Changes
    - Add `account_type` column to user_broker_connections
      - Supports: 'live', 'challenge', 'verification', 'funded'
      - This allows traders to connect multiple accounts from the same prop firm
        (e.g., challenge account, verification account, and funded account)

  2. Notes
    - Prop firms often require connecting 3 different accounts per trader:
      1. Challenge account (evaluation phase)
      2. Verification account (if required by firm)
      3. Funded account (live trading with firm's capital)
    - Each account has different credentials and server details
*/

-- Add account_type column to user_broker_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN account_type text DEFAULT 'live';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN user_broker_connections.account_type IS 'Account type: live, challenge, verification, or funded (for prop firms)';