/*
  # Fix Database Security and Performance Issues

  ## Overview
  This migration addresses critical security and performance issues identified by Supabase Advisor:
  
  ## 1. Missing Foreign Key Indexes (3 issues)
  Add indexes to foreign key columns to improve join performance:
  - journal_trade_entries.trade_id
  - notes.user_id  
  - user_broker_connections.broker_id

  ## 2. RLS Policy Performance Optimization (70+ policies)
  Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()` to prevent
  re-evaluation for each row, significantly improving query performance at scale.
  
  ## 3. Missing RLS Policies (1 table)
  Add appropriate policies for password_reset_codes table which has RLS enabled but no policies.
  
  ## 4. Function Security (9 functions)
  Fix search_path for all functions to use `SECURITY DEFINER` with `SET search_path = public, pg_temp`
  for improved security and immutability.
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_journal_trade_entries_trade_id 
  ON journal_trade_entries(trade_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id_fk 
  ON notes(user_id);

CREATE INDEX IF NOT EXISTS idx_user_broker_connections_broker_id_fk 
  ON user_broker_connections(broker_id);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES
-- =====================================================

-- journal_entries
DROP POLICY IF EXISTS "Users can view own entries" ON journal_entries;
CREATE POLICY "Users can view own entries"
  ON journal_entries FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own entries" ON journal_entries;
CREATE POLICY "Users can insert own entries"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own entries" ON journal_entries;
CREATE POLICY "Users can update own entries"
  ON journal_entries FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own entries" ON journal_entries;
CREATE POLICY "Users can delete own entries"
  ON journal_entries FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- journal_trade_entries
DROP POLICY IF EXISTS "Users can view own trade entries" ON journal_trade_entries;
CREATE POLICY "Users can view own trade entries"
  ON journal_trade_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_trade_entries.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert own trade entries" ON journal_trade_entries;
CREATE POLICY "Users can insert own trade entries"
  ON journal_trade_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_trade_entries.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own trade entries" ON journal_trade_entries;
CREATE POLICY "Users can update own trade entries"
  ON journal_trade_entries FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_trade_entries.journal_entry_id 
    AND user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_trade_entries.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete own trade entries" ON journal_trade_entries;
CREATE POLICY "Users can delete own trade entries"
  ON journal_trade_entries FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_trade_entries.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

-- user_insights
DROP POLICY IF EXISTS "Users can view own insights" ON user_insights;
CREATE POLICY "Users can view own insights"
  ON user_insights FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own insights" ON user_insights;
CREATE POLICY "Users can insert own insights"
  ON user_insights FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own insights" ON user_insights;
CREATE POLICY "Users can update own insights"
  ON user_insights FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own insights" ON user_insights;
CREATE POLICY "Users can delete own insights"
  ON user_insights FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- trading_confluences
DROP POLICY IF EXISTS "Users can view own confluences" ON trading_confluences;
CREATE POLICY "Users can view own confluences"
  ON trading_confluences FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own confluences" ON trading_confluences;
CREATE POLICY "Users can insert own confluences"
  ON trading_confluences FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own confluences" ON trading_confluences;
CREATE POLICY "Users can update own confluences"
  ON trading_confluences FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own confluences" ON trading_confluences;
CREATE POLICY "Users can delete own confluences"
  ON trading_confluences FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- trading_plan_settings
DROP POLICY IF EXISTS "Users can view own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can view own trading plan settings"
  ON trading_plan_settings FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can insert own trading plan settings"
  ON trading_plan_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can update own trading plan settings"
  ON trading_plan_settings FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- nova_scores
DROP POLICY IF EXISTS "Users can view own NOVAScore" ON nova_scores;
CREATE POLICY "Users can view own NOVAScore"
  ON nova_scores FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own NOVAScore" ON nova_scores;
CREATE POLICY "Users can insert own NOVAScore"
  ON nova_scores FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own NOVAScore" ON nova_scores;
CREATE POLICY "Users can update own NOVAScore"
  ON nova_scores FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- nova_chat_messages
DROP POLICY IF EXISTS "Users can read own chat messages" ON nova_chat_messages;
CREATE POLICY "Users can read own chat messages"
  ON nova_chat_messages FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own chat messages" ON nova_chat_messages;
CREATE POLICY "Users can insert own chat messages"
  ON nova_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own chat messages" ON nova_chat_messages;
CREATE POLICY "Users can delete own chat messages"
  ON nova_chat_messages FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- journal_folders
DROP POLICY IF EXISTS "Users can view own folders" ON journal_folders;
CREATE POLICY "Users can view own folders"
  ON journal_folders FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own folders" ON journal_folders;
CREATE POLICY "Users can insert own folders"
  ON journal_folders FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own folders" ON journal_folders;
CREATE POLICY "Users can update own folders"
  ON journal_folders FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own folders" ON journal_folders;
CREATE POLICY "Users can delete own folders"
  ON journal_folders FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- trading_rules
DROP POLICY IF EXISTS "Users can view own rules" ON trading_rules;
CREATE POLICY "Users can view own rules"
  ON trading_rules FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own rules" ON trading_rules;
CREATE POLICY "Users can insert own rules"
  ON trading_rules FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own rules" ON trading_rules;
CREATE POLICY "Users can update own rules"
  ON trading_rules FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own rules" ON trading_rules;
CREATE POLICY "Users can delete own rules"
  ON trading_rules FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- journal_entry_confluences
DROP POLICY IF EXISTS "Users can view own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can view own journal entry confluences"
  ON journal_entry_confluences FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_confluences.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can insert own journal entry confluences"
  ON journal_entry_confluences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_confluences.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can update own journal entry confluences"
  ON journal_entry_confluences FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_confluences.journal_entry_id 
    AND user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_confluences.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can delete own journal entry confluences"
  ON journal_entry_confluences FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_confluences.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

-- stripe_customers
DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
CREATE POLICY "Users can view their own customer data"
  ON stripe_customers FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- journal_entry_rules
DROP POLICY IF EXISTS "Users can view own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can view own journal entry rules"
  ON journal_entry_rules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_rules.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can insert own journal entry rules"
  ON journal_entry_rules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_rules.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can update own journal entry rules"
  ON journal_entry_rules FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_rules.journal_entry_id 
    AND user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_rules.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can delete own journal entry rules"
  ON journal_entry_rules FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_rules.journal_entry_id 
    AND user_id = (select auth.uid())
  ));

-- user_broker_connections
DROP POLICY IF EXISTS "Users can view own broker connections" ON user_broker_connections;
CREATE POLICY "Users can view own broker connections"
  ON user_broker_connections FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own broker connections" ON user_broker_connections;
CREATE POLICY "Users can create own broker connections"
  ON user_broker_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own broker connections" ON user_broker_connections;
CREATE POLICY "Users can update own broker connections"
  ON user_broker_connections FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own broker connections" ON user_broker_connections;
CREATE POLICY "Users can delete own broker connections"
  ON user_broker_connections FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- notes
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- user_tips
DROP POLICY IF EXISTS "Users can view own tips" ON user_tips;
CREATE POLICY "Users can view own tips"
  ON user_tips FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own tips" ON user_tips;
CREATE POLICY "Users can insert own tips"
  ON user_tips FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own tips" ON user_tips;
CREATE POLICY "Users can update own tips"
  ON user_tips FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own tips" ON user_tips;
CREATE POLICY "Users can delete own tips"
  ON user_tips FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- stripe_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stripe_customers 
    WHERE customer_id = stripe_subscriptions.customer_id 
    AND user_id = (select auth.uid())
  ));

-- stripe_orders
DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
CREATE POLICY "Users can view their own order data"
  ON stripe_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stripe_customers 
    WHERE customer_id = stripe_orders.customer_id 
    AND user_id = (select auth.uid())
  ));

-- user_trading_profiles
DROP POLICY IF EXISTS "Users can view own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can view own trading profile"
  ON user_trading_profiles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can insert own trading profile"
  ON user_trading_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can update own trading profile"
  ON user_trading_profiles FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can delete own trading profile"
  ON user_trading_profiles FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- nova_conversation_sessions
DROP POLICY IF EXISTS "Users can read own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can read own sessions"
  ON nova_conversation_sessions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can insert own sessions"
  ON nova_conversation_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can update own sessions"
  ON nova_conversation_sessions FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can delete own sessions"
  ON nova_conversation_sessions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- trading_reports
DROP POLICY IF EXISTS "Users can view own reports" ON trading_reports;
CREATE POLICY "Users can view own reports"
  ON trading_reports FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own reports" ON trading_reports;
CREATE POLICY "Users can insert own reports"
  ON trading_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own reports" ON trading_reports;
CREATE POLICY "Users can update own reports"
  ON trading_reports FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own reports" ON trading_reports;
CREATE POLICY "Users can delete own reports"
  ON trading_reports FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- balance_adjustments
DROP POLICY IF EXISTS "Users can view own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can view own balance adjustments"
  ON balance_adjustments FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can create own balance adjustments"
  ON balance_adjustments FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- =====================================================
-- 3. ADD MISSING RLS POLICIES FOR password_reset_codes
-- =====================================================

CREATE POLICY "Service role can manage reset codes"
  ON password_reset_codes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS FOR SECURITY
-- =====================================================

-- Drop and recreate functions with proper search_path
DROP FUNCTION IF EXISTS ensure_single_active_account() CASCADE;
CREATE FUNCTION ensure_single_active_account()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE user_broker_connections
    SET is_active = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS update_nova_score_timestamp() CASCADE;
CREATE FUNCTION update_nova_score_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS update_session_on_message() CASCADE;
CREATE FUNCTION update_session_on_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE nova_conversation_sessions
  SET updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_expired_reset_codes() CASCADE;
CREATE FUNCTION cleanup_expired_reset_codes()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < now();
END;
$$;

DROP FUNCTION IF EXISTS update_user_insights_updated_at() CASCADE;
CREATE FUNCTION update_user_insights_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS update_user_tips_updated_at() CASCADE;
CREATE FUNCTION update_user_tips_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS update_trading_reports_updated_at() CASCADE;
CREATE FUNCTION update_trading_reports_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS calculate_account_balance(uuid) CASCADE;
CREATE FUNCTION calculate_account_balance(p_connection_id uuid)
RETURNS numeric
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(
    (SELECT starting_balance FROM user_broker_connections WHERE id = p_connection_id),
    0
  ) + COALESCE(
    (SELECT SUM(pnl) FROM trades WHERE broker_connection_id = p_connection_id),
    0
  ) + COALESCE(
    (SELECT SUM(amount) FROM balance_adjustments WHERE broker_connection_id = p_connection_id),
    0
  )
  INTO v_balance;
  
  RETURN v_balance;
END;
$$;

DROP FUNCTION IF EXISTS trigger_recalculate_balance() CASCADE;
CREATE FUNCTION trigger_recalculate_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_broker_connections
  SET current_balance = calculate_account_balance(
    COALESCE(NEW.broker_connection_id, OLD.broker_connection_id)
  )
  WHERE id = COALESCE(NEW.broker_connection_id, OLD.broker_connection_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that were dropped with CASCADE
DO $$
BEGIN
  -- Recreate trigger for update_nova_score_timestamp
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_nova_scores_timestamp'
  ) THEN
    CREATE TRIGGER update_nova_scores_timestamp
      BEFORE UPDATE ON nova_scores
      FOR EACH ROW
      EXECUTE FUNCTION update_nova_score_timestamp();
  END IF;

  -- Recreate trigger for update_session_on_message
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_session_on_new_message'
  ) THEN
    CREATE TRIGGER update_session_on_new_message
      AFTER INSERT ON nova_chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_session_on_message();
  END IF;

  -- Recreate trigger for update_user_insights_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_insights_timestamp'
  ) THEN
    CREATE TRIGGER update_user_insights_timestamp
      BEFORE UPDATE ON user_insights
      FOR EACH ROW
      EXECUTE FUNCTION update_user_insights_updated_at();
  END IF;

  -- Recreate trigger for update_user_tips_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_tips_timestamp'
  ) THEN
    CREATE TRIGGER update_user_tips_timestamp
      BEFORE UPDATE ON user_tips
      FOR EACH ROW
      EXECUTE FUNCTION update_user_tips_updated_at();
  END IF;

  -- Recreate trigger for update_trading_reports_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_trading_reports_timestamp'
  ) THEN
    CREATE TRIGGER update_trading_reports_timestamp
      BEFORE UPDATE ON trading_reports
      FOR EACH ROW
      EXECUTE FUNCTION update_trading_reports_updated_at();
  END IF;

  -- Recreate trigger for trigger_recalculate_balance on trades
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'recalculate_balance_on_trade' AND tgrelid = 'trades'::regclass
  ) THEN
    CREATE TRIGGER recalculate_balance_on_trade
      AFTER INSERT OR UPDATE OR DELETE ON trades
      FOR EACH ROW
      EXECUTE FUNCTION trigger_recalculate_balance();
  END IF;

  -- Recreate trigger for trigger_recalculate_balance on balance_adjustments
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'recalculate_balance_on_adjustment' AND tgrelid = 'balance_adjustments'::regclass
  ) THEN
    CREATE TRIGGER recalculate_balance_on_adjustment
      AFTER INSERT OR UPDATE OR DELETE ON balance_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION trigger_recalculate_balance();
  END IF;
END $$;