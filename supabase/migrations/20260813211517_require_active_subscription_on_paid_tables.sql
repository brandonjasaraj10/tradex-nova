/*
  # Require an active subscription on all paid feature tables (server-side)

  ## Problem
  The subscription/paywall check only existed client-side
  (checkSubscriptionAccess() gating PrivateRoute). Every data table's
  RLS only checked row ownership (user_id = auth.uid()), never
  subscription status - so a signed-up user with no active
  subscription could bypass the UI paywall entirely by calling the
  Supabase client directly (e.g. from devtools) and get full access to
  every paid feature for free.

  ## Fix
  Add has_active_subscription(), mirroring the exact logic already
  used client-side in subscriptionService.ts's checkSubscriptionAccess
  (admin bypass, active/trialing, canceled-but-still-in-period,
  past_due-with-grace-period), then require it alongside the existing
  ownership check on every policy across the 23 paid-feature tables.
  user_profiles, subscriptions, and notifications are deliberately left
  ungated so profile setup, reading your own subscription status, and
  renewal notifications keep working regardless of payment status.

  This migration is generated from the exact live policy definitions
  on this database (pulled via `supabase db query --linked`) rather
  than the migration files in this repo, since this database's actual
  RLS policies have drifted from what those files describe.
*/

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com'])
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          s.status IN ('active', 'trialing')
          OR (s.status = 'canceled' AND s.current_period_end > now())
          OR (s.status = 'past_due' AND s.grace_period_end > now())
        )
    );
$$;

DROP POLICY IF EXISTS "Users can delete own balances" ON account_balances;
CREATE POLICY "Users can delete own balances"
  ON account_balances
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own balances" ON account_balances;
CREATE POLICY "Users can insert own balances"
  ON account_balances
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own balances" ON account_balances;
CREATE POLICY "Users can view own balances"
  ON account_balances
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own balances" ON account_balances;
CREATE POLICY "Users can update own balances"
  ON account_balances
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can insert own balance adjustments"
  ON balance_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own balance adjustments" ON balance_adjustments;
CREATE POLICY "Users can view own balance adjustments"
  ON balance_adjustments
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own broker connections" ON broker_connections;
CREATE POLICY "Users can delete own broker connections"
  ON broker_connections
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own broker connections" ON broker_connections;
CREATE POLICY "Users can insert own broker connections"
  ON broker_connections
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own broker connections" ON broker_connections;
CREATE POLICY "Users can view own broker connections"
  ON broker_connections
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own broker connections" ON broker_connections;
CREATE POLICY "Users can update own broker connections"
  ON broker_connections
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own entries" ON journal_entries;
CREATE POLICY "Users can delete own entries"
  ON journal_entries
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own entries" ON journal_entries;
CREATE POLICY "Users can insert own entries"
  ON journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own entries" ON journal_entries;
CREATE POLICY "Users can view own entries"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own entries" ON journal_entries;
CREATE POLICY "Users can update own entries"
  ON journal_entries
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can delete own journal entry confluences"
  ON journal_entry_confluences
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_confluences.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can insert own journal entry confluences"
  ON journal_entry_confluences
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_confluences.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can view own journal entry confluences"
  ON journal_entry_confluences
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_confluences.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own journal entry confluences" ON journal_entry_confluences;
CREATE POLICY "Users can update own journal entry confluences"
  ON journal_entry_confluences
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_confluences.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription())
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_confluences.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can delete own journal entry rules"
  ON journal_entry_rules
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_rules.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can insert own journal entry rules"
  ON journal_entry_rules
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_rules.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can view own journal entry rules"
  ON journal_entry_rules
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_rules.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own journal entry rules" ON journal_entry_rules;
CREATE POLICY "Users can update own journal entry rules"
  ON journal_entry_rules
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_rules.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription())
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_entry_rules.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own folders" ON journal_folders;
CREATE POLICY "Users can delete own folders"
  ON journal_folders
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own folders" ON journal_folders;
CREATE POLICY "Users can insert own folders"
  ON journal_folders
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own folders" ON journal_folders;
CREATE POLICY "Users can view own folders"
  ON journal_folders
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own folders" ON journal_folders;
CREATE POLICY "Users can update own folders"
  ON journal_folders
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can delete screenshots for own entries"
  ON journal_screenshots
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_screenshots.entry_id) AND (journal_entries.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can insert screenshots for own entries"
  ON journal_screenshots
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_screenshots.entry_id) AND (journal_entries.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view screenshots for own entries" ON journal_screenshots;
CREATE POLICY "Users can view screenshots for own entries"
  ON journal_screenshots
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries
  WHERE ((journal_entries.id = journal_screenshots.entry_id) AND (journal_entries.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can delete own journal trade entries"
  ON journal_trade_entries
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_trade_entries.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can insert own journal trade entries"
  ON journal_trade_entries
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_trade_entries.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can view own journal trade entries"
  ON journal_trade_entries
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_trade_entries.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own journal trade entries" ON journal_trade_entries;
CREATE POLICY "Users can update own journal trade entries"
  ON journal_trade_entries
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_trade_entries.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription())
  WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries je
  WHERE ((je.id = journal_trade_entries.journal_entry_id) AND (je.user_id = ( SELECT auth.uid() AS uid))))) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes"
  ON notes
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes"
  ON notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes"
  ON notes
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes"
  ON notes
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own notes folders" ON notes_folders;
CREATE POLICY "Users can delete own notes folders"
  ON notes_folders
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own notes folders" ON notes_folders;
CREATE POLICY "Users can insert own notes folders"
  ON notes_folders
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own notes folders" ON notes_folders;
CREATE POLICY "Users can view own notes folders"
  ON notes_folders
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own notes folders" ON notes_folders;
CREATE POLICY "Users can update own notes folders"
  ON notes_folders
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own chat history" ON nova_chat_history;
CREATE POLICY "Users can delete own chat history"
  ON nova_chat_history
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own chat messages" ON nova_chat_history;
CREATE POLICY "Users can insert own chat messages"
  ON nova_chat_history
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own chat history" ON nova_chat_history;
CREATE POLICY "Users can view own chat history"
  ON nova_chat_history
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own messages" ON nova_chat_messages;
CREATE POLICY "Users can delete own messages"
  ON nova_chat_messages
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own messages" ON nova_chat_messages;
CREATE POLICY "Users can insert own messages"
  ON nova_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own messages" ON nova_chat_messages;
CREATE POLICY "Users can view own messages"
  ON nova_chat_messages
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can delete own sessions"
  ON nova_conversation_sessions
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can insert own sessions"
  ON nova_conversation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can view own sessions"
  ON nova_conversation_sessions
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own sessions" ON nova_conversation_sessions;
CREATE POLICY "Users can update own sessions"
  ON nova_conversation_sessions
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own scores" ON nova_score;
CREATE POLICY "Users can insert own scores"
  ON nova_score
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own scores" ON nova_score;
CREATE POLICY "Users can view own scores"
  ON nova_score
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own scores" ON nova_score;
CREATE POLICY "Users can update own scores"
  ON nova_score
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own trades" ON trades;
CREATE POLICY "Users can delete own trades"
  ON trades
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
CREATE POLICY "Users can insert own trades"
  ON trades
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
  ON trades
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own trades" ON trades;
CREATE POLICY "Users can update own trades"
  ON trades
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own confluences" ON trading_confluences;
CREATE POLICY "Users can delete own confluences"
  ON trading_confluences
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own confluences" ON trading_confluences;
CREATE POLICY "Users can insert own confluences"
  ON trading_confluences
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own confluences" ON trading_confluences;
CREATE POLICY "Users can view own confluences"
  ON trading_confluences
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own confluences" ON trading_confluences;
CREATE POLICY "Users can update own confluences"
  ON trading_confluences
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can delete own trading plan settings"
  ON trading_plan_settings
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can insert own trading plan settings"
  ON trading_plan_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can view own trading plan settings"
  ON trading_plan_settings
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own trading plan settings" ON trading_plan_settings;
CREATE POLICY "Users can update own trading plan settings"
  ON trading_plan_settings
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own reports" ON trading_reports;
CREATE POLICY "Users can delete own reports"
  ON trading_reports
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own reports" ON trading_reports;
CREATE POLICY "Users can insert own reports"
  ON trading_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own reports" ON trading_reports;
CREATE POLICY "Users can view own reports"
  ON trading_reports
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own rules" ON trading_rules;
CREATE POLICY "Users can delete own rules"
  ON trading_rules
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own rules" ON trading_rules;
CREATE POLICY "Users can insert own rules"
  ON trading_rules
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own rules" ON trading_rules;
CREATE POLICY "Users can view own rules"
  ON trading_rules
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own rules" ON trading_rules;
CREATE POLICY "Users can update own rules"
  ON trading_rules
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own insights" ON user_insights;
CREATE POLICY "Users can delete own insights"
  ON user_insights
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own insights" ON user_insights;
CREATE POLICY "Users can insert own insights"
  ON user_insights
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own insights" ON user_insights;
CREATE POLICY "Users can view own insights"
  ON user_insights
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own insights" ON user_insights;
CREATE POLICY "Users can update own insights"
  ON user_insights
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can delete own tips" ON user_tips;
CREATE POLICY "Users can delete own tips"
  ON user_tips
  FOR DELETE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own tips" ON user_tips;
CREATE POLICY "Users can insert own tips"
  ON user_tips
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own tips" ON user_tips;
CREATE POLICY "Users can view own tips"
  ON user_tips
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own tips" ON user_tips;
CREATE POLICY "Users can update own tips"
  ON user_tips
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can insert own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can insert own trading profile"
  ON user_trading_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can view own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can view own trading profile"
  ON user_trading_profiles
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());

DROP POLICY IF EXISTS "Users can update own trading profile" ON user_trading_profiles;
CREATE POLICY "Users can update own trading profile"
  ON user_trading_profiles
  FOR UPDATE
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription())
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND public.has_active_subscription());
