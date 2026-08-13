/*
  # Create Trading Rules and Journal Entry Tracking System

  ## Overview
  Creates a system to track trading rules alongside confluences, and links them to journal entries
  to analyze how well traders are following their trading plans.

  ## New Tables
  
  ### `trading_rules`
  Stores user-defined trading rules (e.g., "Don't trade first 15 minutes", "Max 3 trades per day")
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `name` (text) - Rule name
  - `description` (text) - Detailed rule description
  - `category` (text) - Category: 'risk_management', 'timing', 'psychology', 'strategy', 'other'
  - `enabled` (boolean) - Whether this rule is currently active
  - `order_index` (integer) - Display order
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `journal_entry_confluences`
  Tracks which confluences were checked off for each journal entry
  - `id` (uuid, primary key)
  - `journal_entry_id` (uuid, foreign key to journal_entries)
  - `confluence_id` (uuid, foreign key to trading_confluences)
  - `checked` (boolean) - Whether this confluence was present in the trade
  - `notes` (text) - Optional notes about this confluence
  - `created_at` (timestamptz)
  
  ### `journal_entry_rules`
  Tracks which trading rules were followed/violated for each journal entry
  - `id` (uuid, primary key)
  - `journal_entry_id` (uuid, foreign key to journal_entries)
  - `rule_id` (uuid, foreign key to trading_rules)
  - `followed` (boolean) - Whether the rule was followed
  - `notes` (text) - Optional notes about adherence/violation
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  
  ## Indexes
  - Performance indexes for common queries
  
  ## Notes
  - Nova AI can use this data to provide insights on trading discipline
  - Users can see their rule adherence and confluence usage patterns
  - Helps identify which rules are consistently followed and which are broken
*/

-- Create trading_rules table
CREATE TABLE IF NOT EXISTS trading_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'other' CHECK (category IN ('risk_management', 'timing', 'psychology', 'strategy', 'other')),
  enabled boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create journal_entry_confluences table
CREATE TABLE IF NOT EXISTS journal_entry_confluences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  confluence_id uuid REFERENCES trading_confluences(id) ON DELETE CASCADE NOT NULL,
  checked boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, confluence_id)
);

-- Create journal_entry_rules table
CREATE TABLE IF NOT EXISTS journal_entry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  rule_id uuid REFERENCES trading_rules(id) ON DELETE CASCADE NOT NULL,
  followed boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(journal_entry_id, rule_id)
);

-- Enable RLS
ALTER TABLE trading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_confluences ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_rules ENABLE ROW LEVEL SECURITY;

-- Policies for trading_rules
CREATE POLICY "Users can view own rules"
  ON trading_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
  ON trading_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
  ON trading_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
  ON trading_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for journal_entry_confluences
CREATE POLICY "Users can view own journal entry confluences"
  ON journal_entry_confluences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_confluences.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own journal entry confluences"
  ON journal_entry_confluences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_confluences.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own journal entry confluences"
  ON journal_entry_confluences
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_confluences.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_confluences.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own journal entry confluences"
  ON journal_entry_confluences
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_confluences.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Policies for journal_entry_rules
CREATE POLICY "Users can view own journal entry rules"
  ON journal_entry_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_rules.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own journal entry rules"
  ON journal_entry_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_rules.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own journal entry rules"
  ON journal_entry_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_rules.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_rules.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own journal entry rules"
  ON journal_entry_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_rules.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trading_rules_user_id ON trading_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_rules_category ON trading_rules(user_id, category);
CREATE INDEX IF NOT EXISTS idx_journal_entry_confluences_entry ON journal_entry_confluences(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_confluences_confluence ON journal_entry_confluences(confluence_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_rules_entry ON journal_entry_rules(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_rules_rule ON journal_entry_rules(rule_id);

-- Trigger for trading_rules updated_at
DROP TRIGGER IF EXISTS update_trading_rules_updated_at ON trading_rules;
CREATE TRIGGER update_trading_rules_updated_at
  BEFORE UPDATE ON trading_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
