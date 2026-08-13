/*
  # Restore Foreign Key Indexes

  ## Overview
  This migration restores foreign key indexes that were incorrectly dropped in the previous migration.
  The indexes were marked as "unused" but are essential for foreign key constraint performance.

  ## Why Keep These Indexes
  Foreign key indexes are crucial for:
  - JOIN operation performance
  - CASCADE update/delete performance
  - Foreign key constraint validation
  - Parent table lookups when child records are inserted/updated
  
  Even if not "used" by current queries, these indexes prevent performance degradation
  as the application grows and query patterns evolve.

  ## 1. Restore Foreign Key Indexes (3 indexes)
  Re-creating indexes for foreign keys on:
  - journal_trade_entries: trade_id
  - notes: user_id
  - user_broker_connections: broker_id

  ## 2. Note on "Unused" Indexes
  The 7 indexes added in the previous migration (showing as unused) should be KEPT.
  They're essential for foreign key performance and will be used as data grows.

  ## 3. Manual Configuration Required
  - Auth DB Connection Strategy: Switch to percentage-based in Database Settings
  - Leaked Password Protection: Enable in Authentication Settings
*/

-- =====================================================
-- RESTORE FOREIGN KEY INDEXES
-- =====================================================

-- Index for journal_trade_entries foreign key
CREATE INDEX IF NOT EXISTS idx_journal_trade_entries_trade_id 
  ON journal_trade_entries(trade_id);

-- Index for notes foreign key
CREATE INDEX IF NOT EXISTS idx_notes_user_id 
  ON notes(user_id);

-- Index for user_broker_connections foreign key
CREATE INDEX IF NOT EXISTS idx_user_broker_connections_broker_id 
  ON user_broker_connections(broker_id);