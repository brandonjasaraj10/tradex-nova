/*
  # Create New Broker Auto-Sync Infrastructure

  1. New Tables
    - `brokers` - Broker platform directory
    - `user_broker_connections` - User's connected broker accounts
  
  2. Changes to Existing Tables
    - Add `broker_connection_id` to `trades` table
    - Add fields to support auto-sync: `broker_trade_id`, `asset_class`, `side`, `entry_time`, `exit_time`
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for user-specific access
*/

-- Create brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'multi_asset',
  supports_auto_sync boolean DEFAULT true,
  supports_file_upload boolean DEFAULT true,
  status text NOT NULL DEFAULT 'live',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_broker_connections table
CREATE TABLE IF NOT EXISTS user_broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  account_name text NOT NULL DEFAULT '',
  connection_type text NOT NULL DEFAULT 'api_key',
  api_key text,
  api_secret text,
  access_token text,
  refresh_token text,
  account_id text,
  status text NOT NULL DEFAULT 'disconnected',
  last_synced_at timestamptz,
  last_error text,
  trades_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add new columns to existing trades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'broker_connection_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN broker_connection_id uuid REFERENCES user_broker_connections(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'broker_trade_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN broker_trade_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'asset_class'
  ) THEN
    ALTER TABLE trades ADD COLUMN asset_class text DEFAULT 'stock';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'side'
  ) THEN
    ALTER TABLE trades ADD COLUMN side text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'entry_time'
  ) THEN
    ALTER TABLE trades ADD COLUMN entry_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'exit_time'
  ) THEN
    ALTER TABLE trades ADD COLUMN exit_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'commission'
  ) THEN
    ALTER TABLE trades ADD COLUMN commission decimal(20,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'raw_broker_payload'
  ) THEN
    ALTER TABLE trades ADD COLUMN raw_broker_payload jsonb;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_user_id ON user_broker_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_status ON user_broker_connections(status);
CREATE INDEX IF NOT EXISTS idx_trades_broker_connection_id ON trades(broker_connection_id);
CREATE INDEX IF NOT EXISTS idx_trades_broker_trade_id ON trades(broker_trade_id);

-- Create unique index for broker trades (only when broker_connection_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_unique_broker_import
  ON trades(user_id, broker_connection_id, broker_trade_id)
  WHERE broker_connection_id IS NOT NULL AND broker_trade_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_broker_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brokers (publicly readable)
DROP POLICY IF EXISTS "Anyone can view brokers" ON brokers;
CREATE POLICY "Anyone can view brokers"
  ON brokers FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_broker_connections
DROP POLICY IF EXISTS "Users can view own broker connections" ON user_broker_connections;
CREATE POLICY "Users can view own broker connections"
  ON user_broker_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own broker connections" ON user_broker_connections;
CREATE POLICY "Users can create own broker connections"
  ON user_broker_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own broker connections" ON user_broker_connections;
CREATE POLICY "Users can update own broker connections"
  ON user_broker_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own broker connections" ON user_broker_connections;
CREATE POLICY "Users can delete own broker connections"
  ON user_broker_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_brokers_updated_at ON brokers;
CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_broker_connections_updated_at ON user_broker_connections;
CREATE TRIGGER update_user_broker_connections_updated_at
  BEFORE UPDATE ON user_broker_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();