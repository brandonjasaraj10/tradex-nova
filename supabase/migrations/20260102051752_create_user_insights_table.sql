/*
  # Create User Insights Table

  1. New Tables
    - `user_insights`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `insight_type` (text) - Type of insight: performance, risk, opportunity, pattern, discipline
      - `title` (text) - Insight title
      - `description` (text) - Detailed insight description
      - `category` (text) - Category: positive, warning, neutral
      - `priority` (int) - Priority score 1-10
      - `data` (jsonb) - Supporting data for the insight
      - `is_dismissed` (boolean) - Whether user dismissed it
      - `dismissed_at` (timestamptz) - When it was dismissed
      - `generated_at` (timestamptz) - When insight was generated
      - `expires_at` (timestamptz) - When insight should be refreshed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_insights` table
    - Add policies for authenticated users to manage their own insights
*/

CREATE TABLE IF NOT EXISTS user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('performance', 'risk', 'opportunity', 'pattern', 'discipline', 'psychology', 'consistency')),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('positive', 'warning', 'neutral', 'critical')),
  priority integer NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  data jsonb DEFAULT '{}',
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_active ON user_insights(user_id, is_dismissed, expires_at) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_user_insights_priority ON user_insights(user_id, priority DESC) WHERE is_dismissed = false;

ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON user_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON user_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON user_insights
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON user_insights
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_insights_updated_at
  BEFORE UPDATE ON user_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_user_insights_updated_at();