/*
  # Optimize RLS Policies - Group 1

  This migration optimizes RLS policies by wrapping auth.uid() with (select auth.uid()).
  This prevents the function from being re-evaluated for each row, significantly improving
  query performance at scale.

  ## Tables Updated in This Group
  - broker_connections
  - trades
  - user_profiles
  - notifications
  - trading_confluences
  - nova_score
  - nova_chat_history
  - nova_conversation_sessions

  ## Performance Impact
  - Reduces CPU usage for large datasets
  - Improves query response times
  - No functional changes to security or access control
*/

-- ============================================================================
-- broker_connections policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own broker connections" ON broker_connections;
CREATE POLICY "Users can view own broker connections"
  ON broker_connections FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own broker connections" ON broker_connections;
CREATE POLICY "Users can insert own broker connections"
  ON broker_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own broker connections" ON broker_connections;
CREATE POLICY "Users can update own broker connections"
  ON broker_connections FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own broker connections" ON broker_connections;
CREATE POLICY "Users can delete own broker connections"
  ON broker_connections FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- trades policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own trades" ON trades;
CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own trades" ON trades;
CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- user_profiles policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ============================================================================
-- notifications policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- trading_confluences policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own confluences" ON trading_confluences;
CREATE POLICY "Users can view own confluences"
  ON trading_confluences FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own confluences" ON trading_confluences;
CREATE POLICY "Users can insert own confluences"
  ON trading_confluences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own confluences" ON trading_confluences;
CREATE POLICY "Users can update own confluences"
  ON trading_confluences FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own confluences" ON trading_confluences;
CREATE POLICY "Users can delete own confluences"
  ON trading_confluences FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- nova_score policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own scores" ON nova_score;
CREATE POLICY "Users can view own scores"
  ON nova_score FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own scores" ON nova_score;
CREATE POLICY "Users can insert own scores"
  ON nova_score FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own scores" ON nova_score;
CREATE POLICY "Users can update own scores"
  ON nova_score FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- nova_chat_history policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own chat history" ON nova_chat_history;
CREATE POLICY "Users can view own chat history"
  ON nova_chat_history FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own chat messages" ON nova_chat_history;
CREATE POLICY "Users can insert own chat messages"
  ON nova_chat_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own chat history" ON nova_chat_history;
CREATE POLICY "Users can delete own chat history"
  ON nova_chat_history FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- nova_conversation_sessions policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can view own sessions"
  ON nova_conversation_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can insert own sessions"
  ON nova_conversation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can update own sessions"
  ON nova_conversation_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can delete own sessions"
  ON nova_conversation_sessions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));