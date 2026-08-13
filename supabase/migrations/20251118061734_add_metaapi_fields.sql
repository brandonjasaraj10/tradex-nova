/*
  # Add MetaApi Integration Fields

  1. Changes
    - Add `metaapi_account_id` to store MetaApi cloud account ID
    - Add `platform` field to explicitly store MT4 or MT5
    - Add `is_auto_sync_enabled` flag for scheduled sync control

  2. Purpose
    - Enable direct MetaTrader 4/5 auto-sync via MetaApi cloud API
    - Store MetaApi account references for reconnection
    - Allow users to enable/disable auto-sync per connection
*/

-- Add MetaApi account ID field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'metaapi_account_id'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN metaapi_account_id TEXT;
  END IF;
END $$;

-- Add platform field for MT4/MT5
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'platform'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN platform TEXT CHECK (platform IN ('mt4', 'mt5'));
  END IF;
END $$;

-- Add auto-sync enabled flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'is_auto_sync_enabled'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN is_auto_sync_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create index on metaapi_account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_metaapi_account_id 
ON user_broker_connections(metaapi_account_id) 
WHERE metaapi_account_id IS NOT NULL;