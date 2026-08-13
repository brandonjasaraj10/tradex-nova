/*
  # Extend Broker Connections for Multi-Broker Architecture
  
  1. Changes to user_broker_connections
    - Add `broker` enum field (metatrader, ctrader, tradelocker, tradovate, ninjatrader)
    - Add `auth_type` field (metaapi, oauth, api_key, bridge)
    - Add `external_account_id` for broker account IDs
    - Add `expires_at` for OAuth token expiration
    - Add `settings_json` for broker-specific configuration
    - Add `last_success_at` to track successful syncs separately from attempts
    - Add `last_cursor` for incremental sync checkpoints
    - Add `sync_method` (polling, streaming)
    
  2. Indexes
    - Add unique constraint for (user_id, broker, external_account_id)
    - Add unique constraint for (user_id, broker, metaapi_account_id) for metatrader
    
  3. Migration Strategy
    - All new columns are nullable to maintain backward compatibility
    - Existing MT4/MT5 connections will work without changes
    - New broker integrations will populate these fields
*/

-- Add broker type enum column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'broker'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN broker TEXT CHECK (broker IN ('metatrader', 'ctrader', 'tradelocker', 'tradovate', 'ninjatrader'));
  END IF;
END $$;

-- Add auth_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'auth_type'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN auth_type TEXT CHECK (auth_type IN ('metaapi', 'oauth', 'api_key', 'bridge', 'username_password'));
  END IF;
END $$;

-- Add external_account_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'external_account_id'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN external_account_id TEXT;
  END IF;
END $$;

-- Add expires_at column for OAuth
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add settings_json for broker-specific config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'settings_json'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN settings_json JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add last_success_at to track successful syncs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'last_success_at'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN last_success_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add last_cursor for incremental sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'last_cursor'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN last_cursor TEXT;
  END IF;
END $$;

-- Add sync_method column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'sync_method'
  ) THEN
    ALTER TABLE user_broker_connections 
    ADD COLUMN sync_method TEXT CHECK (sync_method IN ('polling', 'streaming')) DEFAULT 'polling';
  END IF;
END $$;

-- Migrate existing MetaTrader connections to use new fields
UPDATE user_broker_connections
SET 
  broker = 'metatrader',
  auth_type = CASE 
    WHEN metaapi_account_id IS NOT NULL THEN 'metaapi'
    WHEN username IS NOT NULL THEN 'username_password'
    ELSE 'api_key'
  END,
  external_account_id = COALESCE(account_id, metaapi_account_id)
WHERE broker IS NULL AND metaapi_account_id IS NOT NULL;

-- Create unique index for external_account_id (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_broker_connections_unique_external
ON user_broker_connections(user_id, broker, external_account_id)
WHERE external_account_id IS NOT NULL AND broker IS NOT NULL;

-- Create unique index for metaapi_account_id (for backwards compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_broker_connections_unique_metaapi
ON user_broker_connections(user_id, metaapi_account_id)
WHERE metaapi_account_id IS NOT NULL;

-- Create index on broker for filtering
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_broker
ON user_broker_connections(broker)
WHERE broker IS NOT NULL;

-- Create index on auth_type
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_auth_type
ON user_broker_connections(auth_type)
WHERE auth_type IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN user_broker_connections.broker IS 'Broker platform: metatrader, ctrader, tradelocker, tradovate, ninjatrader';
COMMENT ON COLUMN user_broker_connections.auth_type IS 'Authentication method: metaapi, oauth, api_key, bridge, username_password';
COMMENT ON COLUMN user_broker_connections.external_account_id IS 'Broker-specific account identifier';
COMMENT ON COLUMN user_broker_connections.settings_json IS 'Broker-specific configuration (server, environment, etc)';
COMMENT ON COLUMN user_broker_connections.last_cursor IS 'Checkpoint for incremental sync';
COMMENT ON COLUMN user_broker_connections.sync_method IS 'Sync method: polling or streaming';