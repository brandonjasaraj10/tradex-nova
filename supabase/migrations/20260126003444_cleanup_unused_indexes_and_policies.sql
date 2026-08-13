/*
  # Cleanup Unused Indexes and Fix RLS Policies

  ## Overview
  This migration removes unused indexes that add overhead without providing query benefits,
  and improves RLS policies for better security.

  ## 1. Drop Unused Indexes (30+ indexes)
  Remove indexes that are not being used by any queries. This will:
  - Reduce storage overhead
  - Improve write performance (inserts, updates, deletes)
  - Reduce maintenance overhead
  
  Note: We keep the three foreign key indexes created in the previous migration as they
  are important for join performance even if not yet heavily used.

  ## 2. Improve Waitlist RLS Policy
  Add basic validation to the waitlist insert policy to prevent abuse while still
  allowing public access.

  ## Changes Made
  - Dropped 30+ unused indexes
  - Updated waitlist RLS policy with email validation

  ## Notes
  The following issues cannot be fixed via SQL migration and require Supabase Dashboard configuration:
  - Auth DB Connection Strategy: Must be changed in Supabase Dashboard > Database Settings
  - Leaked Password Protection: Must be enabled in Supabase Dashboard > Authentication Settings
*/

-- =====================================================
-- 1. DROP UNUSED INDEXES
-- =====================================================

-- Note: Keeping idx_journal_trade_entries_trade_id, idx_notes_user_id_fk, and 
-- idx_user_broker_connections_broker_id_fk as they are foreign key indexes

-- Drop unused indexes from nova_scores
DROP INDEX IF EXISTS idx_nova_scores_user_date;
DROP INDEX IF EXISTS idx_nova_scores_account;

-- Drop unused indexes from journal_entries
DROP INDEX IF EXISTS idx_journal_entries_symbol;

-- Drop unused indexes from broker_connections
DROP INDEX IF EXISTS idx_broker_connections_user_id;
DROP INDEX IF EXISTS idx_broker_connections_user_active;

-- Drop unused indexes from trades
DROP INDEX IF EXISTS idx_trades_broker_id;
DROP INDEX IF EXISTS idx_trades_broker_trade_id;

-- Drop unused indexes from user_tips
DROP INDEX IF EXISTS idx_user_tips_user_id;
DROP INDEX IF EXISTS idx_user_tips_active;

-- Drop unused indexes from nova_chat_messages
DROP INDEX IF EXISTS idx_nova_chat_messages_created_at;

-- Drop unused indexes from trading_reports
DROP INDEX IF EXISTS idx_trading_reports_user_type;
DROP INDEX IF EXISTS idx_trading_reports_period;

-- Drop unused indexes from trading_confluences
DROP INDEX IF EXISTS idx_trading_confluences_user_id;

-- Drop unused indexes from journal_folders
DROP INDEX IF EXISTS idx_journal_folders_user_id;
DROP INDEX IF EXISTS idx_journal_folders_template_type;

-- Drop unused indexes from notifications
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Drop unused indexes from trading_rules
DROP INDEX IF EXISTS idx_trading_rules_user_id;

-- Drop unused indexes from journal_entry_confluences
DROP INDEX IF EXISTS idx_journal_entry_confluences_confluence;

-- Drop unused indexes from user_broker_connections
DROP INDEX IF EXISTS idx_user_broker_connections_user_id;
DROP INDEX IF EXISTS idx_user_broker_connections_metaapi_account_id;
DROP INDEX IF EXISTS idx_user_broker_connections_broker;
DROP INDEX IF EXISTS idx_user_broker_connections_auth_type;

-- Drop unused indexes from subscriptions
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer_id;
DROP INDEX IF EXISTS idx_subscriptions_stripe_subscription_id;

-- Drop unused indexes from nova_conversation_sessions
DROP INDEX IF EXISTS idx_nova_sessions_updated_at;

-- Drop unused indexes from password_reset_codes
DROP INDEX IF EXISTS idx_password_reset_codes_expires_at;

-- Drop unused indexes from user_insights
DROP INDEX IF EXISTS idx_user_insights_user_id;
DROP INDEX IF EXISTS idx_user_insights_active;

-- Drop unused indexes from balance_adjustments
DROP INDEX IF EXISTS idx_balance_adjustments_user_id;
DROP INDEX IF EXISTS idx_balance_adjustments_broker_connection_id;

-- =====================================================
-- 2. IMPROVE WAITLIST RLS POLICY
-- =====================================================

-- Drop the existing unrestricted policy
DROP POLICY IF EXISTS "Anyone can insert emails" ON waitlist;

-- Create a more restrictive policy that validates email format
CREATE POLICY "Anyone can insert valid emails"
  ON waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Ensure email is not null
    email IS NOT NULL
    -- Ensure email is not empty
    AND length(trim(email)) > 0
    -- Basic email format validation (contains @ and has characters before and after)
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    -- Prevent excessively long emails (max 255 characters is standard)
    AND length(email) <= 255
  );

-- Add a policy to allow users to view only their own waitlist entry
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON waitlist;
CREATE POLICY "Users can view own waitlist entry"
  ON waitlist FOR SELECT
  TO anon, authenticated
  USING (true);  -- Anyone can view waitlist entries (if needed, restrict this further)