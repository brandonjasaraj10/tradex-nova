/*
  # Create NOVAScore Table

  1. New Tables
    - `nova_scores`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `account_id` (uuid, references broker_connections, nullable)
      - `overall_score` (integer, 0-100)
      - `consistency_score` (integer, 0-100)
      - `risk_management_score` (integer, 0-100)
      - `profitability_score` (integer, 0-100)
      - `discipline_score` (integer, 0-100)
      - `execution_score` (integer, 0-100)
      - `win_rate` (numeric)
      - `profit_factor` (numeric)
      - `avg_win_loss_ratio` (numeric)
      - `total_trades` (integer)
      - `calculation_date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `nova_scores` table
    - Add policies for authenticated users to read their own scores
    - Add policies for authenticated users to insert/update their own scores

  3. Indexes
    - Index on user_id and calculation_date for fast lookups
    - Index on account_id for filtering by account
*/

CREATE TABLE IF NOT EXISTS nova_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES broker_connections(id) ON DELETE CASCADE,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  consistency_score integer NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  risk_management_score integer NOT NULL CHECK (risk_management_score >= 0 AND risk_management_score <= 100),
  profitability_score integer NOT NULL CHECK (profitability_score >= 0 AND profitability_score <= 100),
  discipline_score integer NOT NULL CHECK (discipline_score >= 0 AND discipline_score <= 100),
  execution_score integer NOT NULL CHECK (execution_score >= 0 AND execution_score <= 100),
  win_rate numeric(5,2) DEFAULT 0,
  profit_factor numeric(10,2) DEFAULT 0,
  avg_win_loss_ratio numeric(10,2) DEFAULT 0,
  total_trades integer DEFAULT 0,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nova_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own NOVAScore"
  ON nova_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own NOVAScore"
  ON nova_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own NOVAScore"
  ON nova_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nova_scores_user_date 
  ON nova_scores(user_id, calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_nova_scores_account 
  ON nova_scores(account_id, calculation_date DESC);

CREATE OR REPLACE FUNCTION update_nova_score_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nova_scores_updated_at
  BEFORE UPDATE ON nova_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_nova_score_timestamp();
