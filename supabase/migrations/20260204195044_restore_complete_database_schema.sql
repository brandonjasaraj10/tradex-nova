/*
  # Restore Complete TradeX Database Schema

  This migration restores the full database schema including:

  1. Core Tables:
     - user_profiles: User account settings and preferences
     - notifications: System notifications
     - subscriptions: Subscription and payment tracking
     - password_reset_codes: Password reset functionality
     
  2. Trading Data:
     - trading_confluences: Trade setup confluences
     - trading_rules: User trading rules and violations
     - account_balances: Account balance history
     - user_trading_profiles: Trading style and preferences
     
  3. Journal System:
     - journal_folders: Organize journal entries
     - journal_entries: Trade journals with psychology tracking
     - journal_screenshots: Trade screenshots storage
     
  4. Nova AI System:
     - nova_score: Daily Nova performance scores
     - nova_chat_history: Chat message history
     - nova_conversation_sessions: Conversation sessions
     
  5. Insights & Analytics:
     - user_insights: AI-generated insights
     - user_tips: Personalized tips
     - trading_reports: Performance reports
     - notes: User notes
     - notes_folders: Organize notes

  6. Storage:
     - journal-screenshots bucket for trade screenshots

  7. Security:
     - RLS enabled on all tables
     - Policies for authenticated users
*/

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  preferred_currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tour_completed boolean DEFAULT false,
  stripe_customer_id text
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRADING CONFLUENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  required_count integer DEFAULT 3,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'active'
);

ALTER TABLE trading_confluences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confluences"
  ON trading_confluences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own confluences"
  ON trading_confluences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own confluences"
  ON trading_confluences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own confluences"
  ON trading_confluences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOVA SCORE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nova_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  date date NOT NULL DEFAULT CURRENT_DATE,
  factors jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE nova_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores"
  ON nova_score FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON nova_score FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scores"
  ON nova_score FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- NOVA CHAT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS nova_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at timestamptz DEFAULT now(),
  session_id uuid
);

ALTER TABLE nova_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON nova_chat_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON nova_chat_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
  ON nova_chat_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOVA CONVERSATION SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS nova_conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nova_conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON nova_conversation_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON nova_conversation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON nova_conversation_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON nova_conversation_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- JOURNAL FOLDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'folder',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
  ON journal_folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders"
  ON journal_folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
  ON journal_folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
  ON journal_folders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- JOURNAL ENTRIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id uuid REFERENCES journal_folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  entry_type text DEFAULT 'general',
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  symbol text,
  mood_before integer,
  mood_after integer,
  confidence_level integer,
  stress_level integer,
  sleep_quality integer,
  rule_following integer,
  patience_level integer,
  focus_level integer,
  emotional_control integer,
  notes text,
  psychology_notes text,
  trade_duration text,
  manual_pnl numeric,
  position_size numeric,
  linked_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- JOURNAL SCREENSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view screenshots for own entries"
  ON journal_screenshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert screenshots for own entries"
  ON journal_screenshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete screenshots for own entries"
  ON journal_screenshots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRADING RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rule_text text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trading_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules"
  ON trading_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
  ON trading_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
  ON trading_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
  ON trading_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  status text DEFAULT 'inactive',
  plan_type text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  grace_period_end timestamptz
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PASSWORD RESET CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage reset codes"
  ON password_reset_codes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- USER TRADING PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_trading_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  trading_style text,
  risk_tolerance text,
  preferred_timeframes text[],
  preferred_instruments text[],
  trading_goals text,
  experience_level text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_trading_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading profile"
  ON user_trading_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading profile"
  ON user_trading_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading profile"
  ON user_trading_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- USER INSIGHTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insight_text text NOT NULL,
  category text,
  priority text DEFAULT 'medium',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON user_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON user_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON user_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON user_insights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- USER TIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tip_text text NOT NULL,
  category text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tips"
  ON user_tips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tips"
  ON user_tips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tips"
  ON user_tips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tips"
  ON user_tips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRADING REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trading_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON trading_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON trading_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON trading_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTES FOLDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'folder',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notes_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes folders"
  ON notes_folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes folders"
  ON notes_folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes folders"
  ON notes_folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes folders"
  ON notes_folders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id uuid REFERENCES notes_folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- ACCOUNT BALANCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  broker_connection_id uuid REFERENCES broker_connections(id) ON DELETE CASCADE,
  balance numeric NOT NULL,
  equity numeric,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balances"
  ON account_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own balances"
  ON account_balances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own balances"
  ON account_balances FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own balances"
  ON account_balances FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE BROKER CONNECTIONS TABLE
-- ============================================================================

DO $$
BEGIN
  -- Add missing columns to broker_connections if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN account_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN account_type text DEFAULT 'live';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN webhook_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'metaapi_account_id'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN metaapi_account_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'metaapi_password'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN metaapi_password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'metaapi_server'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN metaapi_server text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'metaapi_region'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN metaapi_region text DEFAULT 'new-york';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_connections' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN broker_id text;
  END IF;
END $$;

-- ============================================================================
-- CREATE STORAGE BUCKET FOR JOURNAL SCREENSHOTS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-screenshots', 'journal-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for journal-screenshots
CREATE POLICY "Users can upload own screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'journal-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'journal-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'journal-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- CREATE DEFAULT FOLDERS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default journal folders
  INSERT INTO journal_folders (user_id, name, color, icon)
  VALUES 
    (NEW.id, 'Trade Journals', '#3B82F6', 'book-open'),
    (NEW.id, 'Goals & Plans', '#10B981', 'target'),
    (NEW.id, 'Lessons Learned', '#F59E0B', 'lightbulb');
  
  -- Create default notes folder
  INSERT INTO notes_folders (user_id, name, color, icon)
  VALUES (NEW.id, 'General Notes', '#3B82F6', 'sticky-note');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS create_default_folders_trigger ON auth.users;

CREATE TRIGGER create_default_folders_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_folders();

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_broker_id ON trades(broker_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_id ON broker_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_folder_id ON journal_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_journal_screenshots_entry_id ON journal_screenshots(entry_id);
CREATE INDEX IF NOT EXISTS idx_nova_chat_history_user_id ON nova_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_nova_chat_history_session_id ON nova_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON account_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_broker_id ON account_balances(broker_connection_id);
