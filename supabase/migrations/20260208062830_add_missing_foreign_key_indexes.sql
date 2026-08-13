/*
  # Add Missing Foreign Key Indexes

  This migration adds indexes on foreign key columns to improve query performance.

  ## New Indexes
  - `balance_adjustments.user_id`
  - `journal_entries.linked_entry_id`
  - `journal_entries.trade_id`
  - `journal_entry_confluences.confluence_id`
  - `journal_entry_rules.rule_id`
  - `journal_trade_entries.trade_id`
  - `notes.folder_id`
  - `notes.user_id`
  - `notes_folders.user_id`
  - `nova_conversation_sessions.user_id`
  - `password_reset_codes.user_id`
  - `trading_confluences.user_id`
  - `trading_rules.user_id`
  - `user_insights.user_id`
  - `user_tips.user_id`
*/

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user_id 
  ON balance_adjustments(user_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_linked_entry_id 
  ON journal_entries(linked_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_trade_id 
  ON journal_entries(trade_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_confluences_confluence_id 
  ON journal_entry_confluences(confluence_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_rules_rule_id 
  ON journal_entry_rules(rule_id);

CREATE INDEX IF NOT EXISTS idx_journal_trade_entries_trade_id 
  ON journal_trade_entries(trade_id);

CREATE INDEX IF NOT EXISTS idx_notes_folder_id 
  ON notes(folder_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id 
  ON notes(user_id);

CREATE INDEX IF NOT EXISTS idx_notes_folders_user_id 
  ON notes_folders(user_id);

CREATE INDEX IF NOT EXISTS idx_nova_conversation_sessions_user_id 
  ON nova_conversation_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_id 
  ON password_reset_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_trading_confluences_user_id 
  ON trading_confluences(user_id);

CREATE INDEX IF NOT EXISTS idx_trading_rules_user_id 
  ON trading_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_id 
  ON user_insights(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tips_user_id 
  ON user_tips(user_id);