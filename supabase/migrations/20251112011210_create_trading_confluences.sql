/*
  # Create Trading Confluences System

  1. New Tables
    - `trading_confluences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Name of the confluence rule
      - `description` (text) - Description of the rule
      - `enabled` (boolean) - Whether this rule is active
      - `usage_rate` (integer) - Percentage of trades using this confluence
      - `order_index` (integer) - Display order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `trading_plan_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `min_confluences_required` (integer) - Minimum number of confluences needed
      - `total_confluences` (integer) - Total number of confluences defined
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create trading_confluences table
CREATE TABLE IF NOT EXISTS trading_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  enabled boolean DEFAULT true,
  usage_rate integer DEFAULT 0 CHECK (usage_rate >= 0 AND usage_rate <= 100),
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trading_plan_settings table
CREATE TABLE IF NOT EXISTS trading_plan_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  min_confluences_required integer DEFAULT 3,
  total_confluences integer DEFAULT 6,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE trading_confluences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_plan_settings ENABLE ROW LEVEL SECURITY;

-- Policies for trading_confluences
CREATE POLICY "Users can view own confluences"
  ON trading_confluences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own confluences"
  ON trading_confluences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own confluences"
  ON trading_confluences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own confluences"
  ON trading_confluences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for trading_plan_settings
CREATE POLICY "Users can view own trading plan settings"
  ON trading_plan_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading plan settings"
  ON trading_plan_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading plan settings"
  ON trading_plan_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trading_confluences_user_id ON trading_confluences(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_confluences_order ON trading_confluences(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_trading_plan_settings_user_id ON trading_plan_settings(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_trading_confluences_updated_at ON trading_confluences;
CREATE TRIGGER update_trading_confluences_updated_at
  BEFORE UPDATE ON trading_confluences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trading_plan_settings_updated_at ON trading_plan_settings;
CREATE TRIGGER update_trading_plan_settings_updated_at
  BEFORE UPDATE ON trading_plan_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();