/*
  # Optimize RLS Policies - Group 2

  This migration continues optimizing RLS policies by wrapping auth.uid() with (select auth.uid()).

  ## Tables Updated in This Group
  - journal_folders
  - journal_entries
  - journal_screenshots
  - subscriptions
  - trading_rules
  - user_trading_profiles

  ## Performance Impact
  - Reduces CPU usage for large datasets
  - Improves query response times
  - No functional changes to security or access control
*/

-- ============================================================================
-- journal_folders policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own folders" ON journal_folders;
CREATE POLICY "Users can view own folders"
  ON journal_folders FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own folders" ON journal_folders;
CREATE POLICY "Users can insert own folders"
  ON journal_folders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own folders" ON journal_folders;
CREATE POLICY "Users can update own folders"
  ON journal_folders FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own folders" ON journal_folders;
CREATE POLICY "Users can delete own folders"
  ON journal_folders FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- journal_entries policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own entries" ON journal_entries;
CREATE POLICY "Users can view own entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own entries" ON journal_entries;
CREATE POLICY "Users can insert own entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own entries" ON journal_entries;
CREATE POLICY "Users can update own entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own entries" ON journal_entries;
CREATE POLICY "Users can delete own entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- journal_screenshots policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can view screenshots for own entries"
  ON journal_screenshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_screenshots.entry_id
      AND journal_entries.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can insert screenshots for own entries"
  ON journal_screenshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_screenshots.entry_id
      AND journal_entries.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can delete screenshots for own entries"
  ON journal_screenshots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_screenshots.entry_id
      AND journal_entries.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- subscriptions policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- trading_rules policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own rules" ON trading_rules;
CREATE POLICY "Users can view own rules"
  ON trading_rules FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own rules" ON trading_rules;
CREATE POLICY "Users can insert own rules"
  ON trading_rules FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own rules" ON trading_rules;
CREATE POLICY "Users can update own rules"
  ON trading_rules FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own rules" ON trading_rules;
CREATE POLICY "Users can delete own rules"
  ON trading_rules FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- user_trading_profiles policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can view own trading profile"
  ON user_trading_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can insert own trading profile"
  ON user_trading_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can update own trading profile"
  ON user_trading_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));