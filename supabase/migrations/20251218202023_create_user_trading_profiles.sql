/*
  # Create User Trading Profiles Table

  1. New Tables
    - `user_trading_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `preferred_markets` (text array) - Markets user trades (forex, crypto, stocks, indices, commodities)
      - `trading_approach` (text) - scalping, day_trading, swing_trading, position_trading
      - `risk_tolerance` (text) - low, medium, high, very_high
      - `experience_level` (text) - beginner, intermediate, advanced, expert
      - `typical_trade_duration` (text) - Minutes to hours, hours to days, days to weeks, weeks to months
      - `preferred_sessions` (text array) - London, NY, Asia, Sydney
      - `trading_goals` (text) - User's trading goals
      - `focus_areas` (text array) - Areas they want to improve (psychology, risk_management, strategy, discipline, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_trading_profiles` table
    - Add policies for users to manage their own profiles
*/

CREATE TABLE IF NOT EXISTS user_trading_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  preferred_markets text[] DEFAULT ARRAY[]::text[],
  trading_approach text DEFAULT 'day_trading',
  risk_tolerance text DEFAULT 'medium',
  experience_level text DEFAULT 'intermediate',
  typical_trade_duration text DEFAULT 'hours_to_days',
  preferred_sessions text[] DEFAULT ARRAY[]::text[],
  trading_goals text,
  focus_areas text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_trading_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading profile"
  ON user_trading_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading profile"
  ON user_trading_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading profile"
  ON user_trading_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trading profile"
  ON user_trading_profiles
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

CREATE TRIGGER update_user_trading_profiles_updated_at
  BEFORE UPDATE ON user_trading_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();