/*
  # Create trades schema

  1. New Tables
    - `trades`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `symbol` (text)
      - `entry_price` (numeric)
      - `exit_price` (numeric)
      - `quantity` (numeric)
      - `direction` (text)
      - `entry_date` (timestamptz)
      - `exit_date` (timestamptz)
      - `pnl` (numeric)
      - `fees` (numeric)
      - `notes` (text)
      - `tags` (text[])
      - `setup` (text)
      - `timeframe` (text)
      - `screenshot_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on trades table
    - Add policies for CRUD operations
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  symbol text NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric NOT NULL,
  quantity numeric NOT NULL,
  direction text NOT NULL,
  entry_date timestamptz NOT NULL,
  exit_date timestamptz NOT NULL,
  pnl numeric NOT NULL,
  fees numeric DEFAULT 0,
  notes text,
  tags text[],
  setup text,
  timeframe text,
  screenshot_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own trades
CREATE POLICY "Users can view own trades"
  ON trades
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own trades
CREATE POLICY "Users can insert own trades"
  ON trades
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trades
CREATE POLICY "Users can update own trades"
  ON trades
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own trades
CREATE POLICY "Users can delete own trades"
  ON trades
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE
  ON trades
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();