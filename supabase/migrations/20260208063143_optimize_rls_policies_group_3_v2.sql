/*
  # Optimize RLS Policies - Group 3 (Corrected)

  This migration completes the optimization of RLS policies by wrapping auth.uid() with (select auth.uid()).

  ## Tables Updated in This Group
  - user_insights
  - user_tips
  - trading_reports
  - notes_folders
  - notes
  - account_balances
  - nova_chat_messages
  - trading_plan_settings
  - journal_trade_entries
  - journal_entry_confluences
  - journal_entry_rules
  - balance_adjustments

  ## Performance Impact
  - Reduces CPU usage for large datasets
  - Improves query response times
  - Completes the RLS optimization project
*/

-- ============================================================================
-- user_insights policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own insights" ON user_insights;
CREATE POLICY "Users can view own insights"
  ON user_insights FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own insights" ON user_insights;
CREATE POLICY "Users can insert own insights"
  ON user_insights FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own insights" ON user_insights;
CREATE POLICY "Users can update own insights"
  ON user_insights FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own insights" ON user_insights;
CREATE POLICY "Users can delete own insights"
  ON user_insights FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- user_tips policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tips" ON user_tips;
CREATE POLICY "Users can view own tips"
  ON user_tips FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own tips" ON user_tips;
CREATE POLICY "Users can insert own tips"
  ON user_tips FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own tips" ON user_tips;
CREATE POLICY "Users can update own tips"
  ON user_tips FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own tips" ON user_tips;
CREATE POLICY "Users can delete own tips"
  ON user_tips FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- trading_reports policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own reports" ON trading_reports;
CREATE POLICY "Users can view own reports"
  ON trading_reports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own reports" ON trading_reports;
CREATE POLICY "Users can insert own reports"
  ON trading_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own reports" ON trading_reports;
CREATE POLICY "Users can delete own reports"
  ON trading_reports FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- notes_folders policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notes folders" ON notes_folders;
CREATE POLICY "Users can view own notes folders"
  ON notes_folders FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notes folders" ON notes_folders;
CREATE POLICY "Users can insert own notes folders"
  ON notes_folders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notes folders" ON notes_folders;
CREATE POLICY "Users can update own notes folders"
  ON notes_folders FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notes folders" ON notes_folders;
CREATE POLICY "Users can delete own notes folders"
  ON notes_folders FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- notes policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- account_balances policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own balances" ON account_balances;
CREATE POLICY "Users can view own balances"
  ON account_balances FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own balances" ON account_balances;
CREATE POLICY "Users can insert own balances"
  ON account_balances FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own balances" ON account_balances;
CREATE POLICY "Users can update own balances"
  ON account_balances FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own balances" ON account_balances;
CREATE POLICY "Users can delete own balances"
  ON account_balances FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- nova_chat_messages policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own messages" ON nova_chat_messages;
CREATE POLICY "Users can view own messages"
  ON nova_chat_messages FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own messages" ON nova_chat_messages;
CREATE POLICY "Users can insert own messages"
  ON nova_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own messages" ON nova_chat_messages;
CREATE POLICY "Users can delete own messages"
  ON nova_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- trading_plan_settings policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can view own trading plan settings"
  ON trading_plan_settings FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can insert own trading plan settings"
  ON trading_plan_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can update own trading plan settings"
  ON trading_plan_settings FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can delete own trading plan settings"
  ON trading_plan_settings FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- journal_trade_entries policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can view own journal trade entries"
  ON journal_trade_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_trade_entries.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can insert own journal trade entries"
  ON journal_trade_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_trade_entries.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can update own journal trade entries"
  ON journal_trade_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_trade_entries.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_trade_entries.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can delete own journal trade entries"
  ON journal_trade_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_trade_entries.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- journal_entry_confluences policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can view own journal entry confluences"
  ON journal_entry_confluences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_confluences.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can insert own journal entry confluences"
  ON journal_entry_confluences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_confluences.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can update own journal entry confluences"
  ON journal_entry_confluences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_confluences.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_confluences.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can delete own journal entry confluences"
  ON journal_entry_confluences FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_confluences.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- journal_entry_rules policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can view own journal entry rules"
  ON journal_entry_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_rules.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can insert own journal entry rules"
  ON journal_entry_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_rules.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can update own journal entry rules"
  ON journal_entry_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_rules.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_rules.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can delete own journal entry rules"
  ON journal_entry_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_rules.journal_entry_id
      AND je.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- balance_adjustments policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can view own balance adjustments"
  ON balance_adjustments FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can insert own balance adjustments"
  ON balance_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));