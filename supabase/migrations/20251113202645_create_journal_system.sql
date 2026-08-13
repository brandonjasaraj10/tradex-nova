/*
  # Create Journal System

  ## Overview
  Creates a comprehensive journal system with customizable folders and date-organized entries.
  Users can organize their journals into folders (Daily Journal, Trades, etc.) and entries are 
  automatically organized by date.

  ## New Tables
  
  ### `journal_folders`
  - `id` (uuid, primary key) - Unique folder identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `name` (text) - Folder name (e.g., "Daily Journal", "Trades")
  - `description` (text, nullable) - Optional folder description
  - `icon` (text, nullable) - Icon identifier for the folder
  - `color` (text) - Color theme for the folder
  - `order_index` (integer) - Custom ordering of folders
  - `created_at` (timestamptz) - Folder creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `journal_entries`
  - `id` (uuid, primary key) - Unique entry identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `folder_id` (uuid, foreign key) - References journal_folders
  - `entry_date` (date) - The date this entry is for
  - `title` (text, nullable) - Optional entry title
  - `content` (text) - Main journal content
  - `mood` (text, nullable) - User's mood for the day
  - `tags` (text array) - Array of tags for categorization
  - `attachments` (jsonb) - Attached files/images metadata
  - `created_at` (timestamptz) - Entry creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `journal_trade_entries`
  - `id` (uuid, primary key) - Unique trade entry identifier
  - `journal_entry_id` (uuid, foreign key) - References journal_entries
  - `trade_id` (uuid, foreign key) - References trades table
  - `analysis` (text, nullable) - Trade analysis notes
  - `lessons_learned` (text, nullable) - What was learned from this trade
  - `emotional_state` (text, nullable) - Emotional state during trade
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own journal folders
  - Users can only access their own journal entries
  - Users can only access their own trade entries
  
  ## Indexes
  - Index on user_id for fast user-specific queries
  - Index on folder_id for fast folder-based queries
  - Index on entry_date for chronological sorting
  - Composite index on (user_id, entry_date) for optimized date queries
*/

-- Create journal_folders table
CREATE TABLE IF NOT EXISTS journal_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  color text DEFAULT '#3B82F6',
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES journal_folders(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title text,
  content text DEFAULT '',
  mood text,
  tags text[] DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create journal_trade_entries table
CREATE TABLE IF NOT EXISTS journal_trade_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  analysis text,
  lessons_learned text,
  emotional_state text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_journal_folders_user_id ON journal_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_folders_order ON journal_folders(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_folder_id ON journal_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_trade_entries_journal ON journal_trade_entries(journal_entry_id);

-- Enable Row Level Security
ALTER TABLE journal_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_trade_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_folders
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

-- RLS Policies for journal_entries
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

-- RLS Policies for journal_trade_entries
CREATE POLICY "Users can view own trade entries"
  ON journal_trade_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_trade_entries.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own trade entries"
  ON journal_trade_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_trade_entries.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own trade entries"
  ON journal_trade_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_trade_entries.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_trade_entries.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own trade entries"
  ON journal_trade_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_trade_entries.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_journal_folders_updated_at ON journal_folders;
CREATE TRIGGER update_journal_folders_updated_at
  BEFORE UPDATE ON journal_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();