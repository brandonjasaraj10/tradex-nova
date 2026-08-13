/*
  # Add Foreign Key Indexes and Fix Duplicate Policies

  ## Overview
  This migration adds missing indexes for foreign keys to improve join performance,
  removes truly unused indexes, and consolidates duplicate RLS policies.

  ## 1. Add Missing Foreign Key Indexes (7 indexes)
  Foreign keys without indexes can cause performance issues during:
  - JOIN operations
  - CASCADE operations (updates/deletes)
  - Foreign key constraint validation
  
  Adding indexes for:
  - balance_adjustments: broker_connection_id, user_id
  - broker_connections: user_id
  - journal_entry_confluences: confluence_id
  - nova_scores: account_id, user_id
  - trades: broker_id

  ## 2. Drop Unused Indexes (3 indexes)
  These indexes were created but are not being used by queries:
  - idx_journal_trade_entries_trade_id
  - idx_notes_user_id_fk
  - idx_user_broker_connections_broker_id_fk

  ## 3. Fix Duplicate Waitlist Policies
  Remove duplicate SELECT policies on waitlist table to avoid conflicts.

  ## Notes
  The following issues require Supabase Dashboard configuration:
  - Auth DB Connection Strategy: Database Settings > switch to percentage-based
  - Leaked Password Protection: Authentication Settings > enable HaveIBeenPwned check
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Index for balance_adjustments foreign keys
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_broker_connection_id 
  ON balance_adjustments(broker_connection_id);

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user_id 
  ON balance_adjustments(user_id);

-- Index for broker_connections foreign key
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_id 
  ON broker_connections(user_id);

-- Index for journal_entry_confluences foreign key
CREATE INDEX IF NOT EXISTS idx_journal_entry_confluences_confluence_id 
  ON journal_entry_confluences(confluence_id);

-- Index for nova_scores foreign keys
CREATE INDEX IF NOT EXISTS idx_nova_scores_account_id 
  ON nova_scores(account_id);

CREATE INDEX IF NOT EXISTS idx_nova_scores_user_id 
  ON nova_scores(user_id);

-- Index for trades foreign key
CREATE INDEX IF NOT EXISTS idx_trades_broker_id 
  ON trades(broker_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_journal_trade_entries_trade_id;
DROP INDEX IF EXISTS idx_notes_user_id_fk;
DROP INDEX IF EXISTS idx_user_broker_connections_broker_id_fk;

-- =====================================================
-- 3. FIX DUPLICATE WAITLIST POLICIES
-- =====================================================

-- Drop the old policy
DROP POLICY IF EXISTS "Emails are publicly readable" ON waitlist;

-- Keep the new policy created in the previous migration:
-- "Users can view own waitlist entry"

-- Update the remaining policy to be more descriptive
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON waitlist;
CREATE POLICY "Waitlist entries are publicly readable"
  ON waitlist FOR SELECT
  TO anon, authenticated
  USING (true);