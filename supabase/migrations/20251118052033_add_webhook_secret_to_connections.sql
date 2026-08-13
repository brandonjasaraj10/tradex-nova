/*
  # Add Webhook Secret for MT4/MT5 Integration

  1. Changes
    - Add `webhook_secret` column to `user_broker_connections` table
    - Generate unique webhook secret for each connection
    - Used to authenticate webhook requests from MT4/MT5 Expert Advisors

  2. Security
    - Webhook secret is required for all MT4/MT5 sync requests
    - Prevents unauthorized trade data submissions
*/

-- Add webhook_secret column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN webhook_secret TEXT DEFAULT encode(gen_random_bytes(32), 'hex');
  END IF;
END $$;

-- Generate webhook secrets for existing connections that don't have one
UPDATE user_broker_connections
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;