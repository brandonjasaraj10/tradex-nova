/*
  Free plan: let signed-in users without a subscription into the journal.

  NOT YET APPLIED. This changes live access rules, so it goes in on launch day
  together with the app change (FREE_PLAN_ENABLED) and the process-voice-journal
  deploy. Applied on its own it would let free users save entries with no
  limit messages or locked screens in the app.

  What changes: on the tables below, "owns the row AND has a subscription"
  becomes "owns the row AND is signed in". Owning the row is untouched, so no
  one can see anyone else's data. Everything else stays paid-only: Nova chat,
  memories, feedback, insights, tips, reports, NOVA Score, mentorships and the
  old notes tables.

  Then the free plan limits are attached: 5 entries a week (notes don't
  count), 2 screenshots an entry, 1 account. Paid access passes straight
  through them.

  Undo, if needed: run the block at the bottom of this file.
*/

CREATE OR REPLACE FUNCTION public.has_journal_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.has_journal_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_journal_access() TO authenticated, service_role;

DO $$
DECLARE
  p record;
  v_sql text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'journal_entries', 'journal_folders', 'journal_entry_confluences',
        'journal_entry_psychology_checks', 'journal_entry_rules', 'journal_screenshots',
        'journal_trade_entries', 'trading_confluences', 'trading_rules',
        'psychology_checks', 'trading_plan_settings', 'broker_connections',
        'account_balances', 'balance_adjustments', 'trades', 'user_trading_profiles'
      ])
      AND (coalesce(qual, '') LIKE '%has_active_subscription()%'
        OR coalesce(with_check, '') LIKE '%has_active_subscription()%')
  LOOP
    v_sql := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF p.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', replace(p.qual, 'has_active_subscription()', 'has_journal_access()'));
    END IF;
    IF p.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', replace(p.with_check, 'has_active_subscription()', 'has_journal_access()'));
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS free_plan_entry_limit ON public.journal_entries;
CREATE TRIGGER free_plan_entry_limit
  BEFORE INSERT OR UPDATE OF folder_id ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.free_plan_enforce_entry();

DROP TRIGGER IF EXISTS free_plan_screenshot_limit ON public.journal_entries;
CREATE TRIGGER free_plan_screenshot_limit
  BEFORE INSERT OR UPDATE OF before_screenshots, after_screenshots ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.free_plan_enforce_screenshots();

DROP TRIGGER IF EXISTS free_plan_account_limit ON public.broker_connections;
CREATE TRIGGER free_plan_account_limit
  BEFORE INSERT ON public.broker_connections
  FOR EACH ROW EXECUTE FUNCTION public.free_plan_enforce_account();

/*
  Undo:

  DROP TRIGGER IF EXISTS free_plan_entry_limit ON public.journal_entries;
  DROP TRIGGER IF EXISTS free_plan_screenshot_limit ON public.journal_entries;
  DROP TRIGGER IF EXISTS free_plan_account_limit ON public.broker_connections;
  DO $$
  DECLARE p record; v_sql text;
  BEGIN
    FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
      WHERE schemaname = 'public'
        AND (coalesce(qual, '') LIKE '%has_journal_access()%' OR coalesce(with_check, '') LIKE '%has_journal_access()%')
    LOOP
      v_sql := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
      IF p.qual IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', replace(p.qual, 'has_journal_access()', 'has_active_subscription()')); END IF;
      IF p.with_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', replace(p.with_check, 'has_journal_access()', 'has_active_subscription()')); END IF;
      EXECUTE v_sql;
    END LOOP;
  END $$;
*/
