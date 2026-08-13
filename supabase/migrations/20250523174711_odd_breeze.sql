/*
  # Add broker integration tables

  1. New Tables
    - `broker_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `broker_type` (text)
      - `credentials` (jsonb)
      - `created_at` (timestamptz)
      - `last_sync` (timestamptz)

  2. Changes
    - Add `broker_id` to trades table
    - Add foreign key constraint

  3. Security
    - Enable RLS on broker_connections table
    - Add policies for CRUD operations
*/

-- Create broker_connections table
CREATE TABLE IF NOT EXISTS broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  broker_type text NOT NULL,
  credentials jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_sync timestamptz DEFAULT now()
);

-- Add broker_id to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS broker_id uuid REFERENCES broker_connections(id);

-- Enable RLS
ALTER TABLE broker_connections ENABLE ROW LEVEL SECURITY;

-- Policies for broker_connections
CREATE POLICY "Users can view own broker connections"
  ON broker_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own broker connections"
  ON broker_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own broker connections"
  ON broker_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own broker connections"
  ON broker_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_id ON broker_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_broker_id ON trades(broker_id);