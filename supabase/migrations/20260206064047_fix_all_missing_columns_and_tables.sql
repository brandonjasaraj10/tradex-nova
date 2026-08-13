/*
  # Fix all missing columns and tables

  This migration aligns the database schema with the frontend code expectations.
  Many columns and tables were referenced in code but missing from the database.

  1. Modified Tables
    - `journal_entries` - Add entry_date, template_data, attachments columns
    - `journal_folders` - Add order_index, template_type, updated_at, description columns
    - `trading_confluences` - Add order_index, usage_rate, updated_at columns
    - `trading_rules` - Add name, description, enabled, order_index, updated_at columns
    - `user_insights` - Add insight_type, title, description, data, is_dismissed, dismissed_at, generated_at, expires_at, updated_at columns
    - `user_tips` - Add tip_category, title, content, icon_name, priority, context_data, is_dismissed, dismissed_at, generated_at, expires_at, updated_at columns
    - `broker_connections` - Add starting_balance, current_balance, currency, last_balance_update, is_auto_sync_enabled, ownership_type columns

  2. New Tables
    - `trading_plan_settings` - Stores user trading plan configuration
    - `journal_trade_entries` - Links journal entries to trades with analysis
    - `journal_entry_confluences` - Tracks confluence checks per journal entry
    - `journal_entry_rules` - Tracks rule compliance per journal entry
    - `balance_adjustments` - Logs balance changes (deposits, withdrawals, corrections)

  3. View Updates
    - `user_broker_connections` - Recreated to include new broker_connections columns

  4. Security
    - RLS enabled on all new tables
    - Policies restrict access to authenticated users and their own data

  5. Data Backfills
    - journal_entries.entry_date populated from created_at for existing rows
    - trading_rules.name populated from rule_text for existing rows
    - trading_rules.enabled populated from is_active for existing rows
*/

-- ============================================
-- 1. journal_entries: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'entry_date'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN entry_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'template_data'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN template_data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

UPDATE journal_entries SET entry_date = DATE(created_at) WHERE entry_date IS NULL;

-- ============================================
-- 2. journal_folders: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_folders' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE journal_folders ADD COLUMN order_index integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_folders' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE journal_folders ADD COLUMN template_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_folders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE journal_folders ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_folders' AND column_name = 'description'
  ) THEN
    ALTER TABLE journal_folders ADD COLUMN description text;
  END IF;
END $$;

-- ============================================
-- 3. trading_confluences: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_confluences' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE trading_confluences ADD COLUMN order_index integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_confluences' AND column_name = 'usage_rate'
  ) THEN
    ALTER TABLE trading_confluences ADD COLUMN usage_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_confluences' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE trading_confluences ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ============================================
-- 4. trading_rules: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_rules' AND column_name = 'name'
  ) THEN
    ALTER TABLE trading_rules ADD COLUMN name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_rules' AND column_name = 'description'
  ) THEN
    ALTER TABLE trading_rules ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_rules' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE trading_rules ADD COLUMN enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_rules' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE trading_rules ADD COLUMN order_index integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE trading_rules ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

UPDATE trading_rules SET name = rule_text WHERE name IS NULL AND rule_text IS NOT NULL;
UPDATE trading_rules SET enabled = is_active WHERE enabled IS NULL AND is_active IS NOT NULL;

-- ============================================
-- 5. user_insights: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'insight_type'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN insight_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'title'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'description'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'data'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'is_dismissed'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN is_dismissed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN dismissed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN generated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ============================================
-- 6. user_tips: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'tip_category'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN tip_category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'title'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'content'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'icon_name'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN icon_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'priority'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN priority integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'context_data'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN context_data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'is_dismissed'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN is_dismissed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN dismissed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN generated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tips' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_tips ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ============================================
-- 7. broker_connections: Add missing columns
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'starting_balance'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN starting_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN current_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'currency'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN currency text DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'last_balance_update'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN last_balance_update timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'is_auto_sync_enabled'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN is_auto_sync_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_connections' AND column_name = 'ownership_type'
  ) THEN
    ALTER TABLE broker_connections ADD COLUMN ownership_type text DEFAULT 'personal';
  END IF;
END $$;

-- ============================================
-- 8. Recreate user_broker_connections view
-- ============================================

DROP VIEW IF EXISTS user_broker_connections;

CREATE VIEW user_broker_connections AS
SELECT
  id,
  user_id,
  account_name,
  broker_type,
  created_at,
  last_sync,
  status,
  broker_id,
  starting_balance,
  current_balance,
  currency,
  last_balance_update,
  is_auto_sync_enabled,
  ownership_type,
  account_type,
  metaapi_account_id
FROM broker_connections;

-- ============================================
-- 9. Create trading_plan_settings table
-- ============================================

CREATE TABLE IF NOT EXISTS trading_plan_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  min_confluences_required integer DEFAULT 3,
  total_confluences integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trading_plan_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trading_plan_settings' AND policyname = 'Users can view own trading plan settings'
  ) THEN
    CREATE POLICY "Users can view own trading plan settings"
      ON trading_plan_settings FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trading_plan_settings' AND policyname = 'Users can insert own trading plan settings'
  ) THEN
    CREATE POLICY "Users can insert own trading plan settings"
      ON trading_plan_settings FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trading_plan_settings' AND policyname = 'Users can update own trading plan settings'
  ) THEN
    CREATE POLICY "Users can update own trading plan settings"
      ON trading_plan_settings FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trading_plan_settings' AND policyname = 'Users can delete own trading plan settings'
  ) THEN
    CREATE POLICY "Users can delete own trading plan settings"
      ON trading_plan_settings FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 10. Create journal_trade_entries table
-- ============================================

CREATE TABLE IF NOT EXISTS journal_trade_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  analysis text,
  lessons_learned text,
  emotional_state text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_trade_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_trade_entries' AND policyname = 'Users can view own journal trade entries'
  ) THEN
    CREATE POLICY "Users can view own journal trade entries"
      ON journal_trade_entries FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_trade_entries.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_trade_entries' AND policyname = 'Users can insert own journal trade entries'
  ) THEN
    CREATE POLICY "Users can insert own journal trade entries"
      ON journal_trade_entries FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_trade_entries.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_trade_entries' AND policyname = 'Users can update own journal trade entries'
  ) THEN
    CREATE POLICY "Users can update own journal trade entries"
      ON journal_trade_entries FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_trade_entries.journal_entry_id
          AND je.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_trade_entries.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_trade_entries' AND policyname = 'Users can delete own journal trade entries'
  ) THEN
    CREATE POLICY "Users can delete own journal trade entries"
      ON journal_trade_entries FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_trade_entries.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- 11. Create journal_entry_confluences table
-- ============================================

CREATE TABLE IF NOT EXISTS journal_entry_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  confluence_id uuid NOT NULL REFERENCES trading_confluences(id) ON DELETE CASCADE,
  checked boolean DEFAULT false,
  present boolean,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, confluence_id)
);

ALTER TABLE journal_entry_confluences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_confluences' AND policyname = 'Users can view own journal entry confluences'
  ) THEN
    CREATE POLICY "Users can view own journal entry confluences"
      ON journal_entry_confluences FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_confluences.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_confluences' AND policyname = 'Users can insert own journal entry confluences'
  ) THEN
    CREATE POLICY "Users can insert own journal entry confluences"
      ON journal_entry_confluences FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_confluences.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_confluences' AND policyname = 'Users can update own journal entry confluences'
  ) THEN
    CREATE POLICY "Users can update own journal entry confluences"
      ON journal_entry_confluences FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_confluences.journal_entry_id
          AND je.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_confluences.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_confluences' AND policyname = 'Users can delete own journal entry confluences'
  ) THEN
    CREATE POLICY "Users can delete own journal entry confluences"
      ON journal_entry_confluences FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_confluences.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- 12. Create journal_entry_rules table
-- ============================================

CREATE TABLE IF NOT EXISTS journal_entry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES trading_rules(id) ON DELETE CASCADE,
  followed boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, rule_id)
);

ALTER TABLE journal_entry_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_rules' AND policyname = 'Users can view own journal entry rules'
  ) THEN
    CREATE POLICY "Users can view own journal entry rules"
      ON journal_entry_rules FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_rules.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_rules' AND policyname = 'Users can insert own journal entry rules'
  ) THEN
    CREATE POLICY "Users can insert own journal entry rules"
      ON journal_entry_rules FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_rules.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_rules' AND policyname = 'Users can update own journal entry rules'
  ) THEN
    CREATE POLICY "Users can update own journal entry rules"
      ON journal_entry_rules FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_rules.journal_entry_id
          AND je.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_rules.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entry_rules' AND policyname = 'Users can delete own journal entry rules'
  ) THEN
    CREATE POLICY "Users can delete own journal entry rules"
      ON journal_entry_rules FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.id = journal_entry_rules.journal_entry_id
          AND je.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- 13. Create balance_adjustments table
-- ============================================

CREATE TABLE IF NOT EXISTS balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  broker_connection_id uuid NOT NULL REFERENCES broker_connections(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  amount numeric NOT NULL,
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balance_adjustments' AND policyname = 'Users can view own balance adjustments'
  ) THEN
    CREATE POLICY "Users can view own balance adjustments"
      ON balance_adjustments FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balance_adjustments' AND policyname = 'Users can insert own balance adjustments'
  ) THEN
    CREATE POLICY "Users can insert own balance adjustments"
      ON balance_adjustments FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 14. Add indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_folders_template_type ON journal_folders(template_type);
CREATE INDEX IF NOT EXISTS idx_journal_trade_entries_journal_entry_id ON journal_trade_entries(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_confluences_journal_entry_id ON journal_entry_confluences(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_rules_journal_entry_id ON journal_entry_rules(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_broker_connection_id ON balance_adjustments(broker_connection_id);
CREATE INDEX IF NOT EXISTS idx_trading_plan_settings_user_id ON trading_plan_settings(user_id);