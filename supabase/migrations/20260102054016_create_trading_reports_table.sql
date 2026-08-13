/*
  # Create Trading Reports Table

  1. New Tables
    - trading_reports: Stores cached trading performance reports
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - report_type (text): weekly, monthly, quarterly, yearly
      - period_start (date): Start date of period
      - period_end (date): End date of period
      - total_trades (int): Total number of trades
      - winning_trades (int): Number of winning trades
      - losing_trades (int): Number of losing trades
      - win_rate (decimal): Win rate percentage
      - total_pnl (decimal): Total profit/loss
      - avg_win (decimal): Average winning trade
      - avg_loss (decimal): Average losing trade
      - risk_reward_ratio (decimal): Average risk-reward ratio
      - best_trade (decimal): Best single trade P&L
      - worst_trade (decimal): Worst single trade P&L
      - largest_win_streak (int): Longest winning streak
      - largest_loss_streak (int): Longest losing streak
      - most_traded_pairs (jsonb): Most traded pairs with counts
      - session_breakdown (jsonb): Trading by session
      - avg_trade_duration (decimal): Average duration in minutes
      - rule_compliance_rate (decimal): Rules compliance percentage
      - avg_psychology_score (decimal): Average psychology score
      - best_trading_day (date): Date of best performance
      - worst_trading_day (date): Date of worst performance
      - total_trading_days (int): Number of days traded
      - key_insights (jsonb): Key insights array
      - generated_at (timestamptz): When generated
      - is_stale (boolean): Needs regeneration flag
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users

  3. Indexes
    - user_id and report_type
    - period dates
    - unique constraint
*/

CREATE TABLE IF NOT EXISTS trading_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_trades integer DEFAULT 0,
  winning_trades integer DEFAULT 0,
  losing_trades integer DEFAULT 0,
  win_rate decimal(5,2) DEFAULT 0,
  total_pnl decimal(15,2) DEFAULT 0,
  avg_win decimal(15,2) DEFAULT 0,
  avg_loss decimal(15,2) DEFAULT 0,
  risk_reward_ratio decimal(5,2) DEFAULT 0,
  best_trade decimal(15,2) DEFAULT 0,
  worst_trade decimal(15,2) DEFAULT 0,
  largest_win_streak integer DEFAULT 0,
  largest_loss_streak integer DEFAULT 0,
  most_traded_pairs jsonb DEFAULT '[]',
  session_breakdown jsonb DEFAULT '{}',
  avg_trade_duration decimal(10,2) DEFAULT 0,
  rule_compliance_rate decimal(5,2) DEFAULT 0,
  avg_psychology_score decimal(5,2) DEFAULT 0,
  best_trading_day date,
  worst_trading_day date,
  total_trading_days integer DEFAULT 0,
  key_insights jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  is_stale boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_reports_user_type ON trading_reports(user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_trading_reports_period ON trading_reports(user_id, period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_reports_unique ON trading_reports(user_id, report_type, period_start);

ALTER TABLE trading_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON trading_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON trading_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON trading_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON trading_reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_trading_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trading_reports_updated_at
  BEFORE UPDATE ON trading_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_reports_updated_at();