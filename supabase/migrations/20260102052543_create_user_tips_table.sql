/*
  # Create User Tips Table

  1. New Tables
    - `user_tips`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `tip_category` (text) - Category: risk_management, psychology, discipline, strategy, market_conditions
      - `title` (text) - Tip title
      - `content` (text) - Detailed tip content
      - `icon_name` (text) - Icon to display
      - `priority` (int) - Priority score 1-10
      - `context_data` (jsonb) - Supporting data that triggered this tip
      - `is_dismissed` (boolean) - Whether user dismissed it
      - `dismissed_at` (timestamptz) - When it was dismissed
      - `generated_at` (timestamptz) - When tip was generated
      - `expires_at` (timestamptz) - When tip should be refreshed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_tips` table
    - Add policies for authenticated users to manage their own tips
*/

CREATE TABLE IF NOT EXISTS user_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tip_category text NOT NULL CHECK (tip_category IN ('risk_management', 'psychology', 'discipline', 'strategy', 'market_conditions', 'consistency', 'timing')),
  title text NOT NULL,
  content text NOT NULL,
  icon_name text NOT NULL DEFAULT 'Award',
  priority integer NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  context_data jsonb DEFAULT '{}',
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '3 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tips_user_id ON user_tips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tips_active ON user_tips(user_id, is_dismissed, expires_at) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_user_tips_priority ON user_tips(user_id, priority DESC) WHERE is_dismissed = false;

ALTER TABLE user_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tips"
  ON user_tips
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tips"
  ON user_tips
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tips"
  ON user_tips
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tips"
  ON user_tips
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_tips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_tips_updated_at
  BEFORE UPDATE ON user_tips
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tips_updated_at();