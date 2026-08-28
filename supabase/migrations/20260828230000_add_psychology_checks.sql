/*
  # Pre-trade psychology checklist

  A third checklist beside confluences and trading rules, asking whether the
  trader is in a fit state to trade at all - rested, calm, not chasing a loss -
  rather than whether the setup is valid.

  ## Why this is not just trading_rules with category='psychology'

  That category already exists and is already in use, but for something else.
  The two rules filed under it today are "Max 1 trade per day" and "Max 1
  Position per day" - behavioural limits their owners deliberately keep in the
  Rules tab. Reusing the category would have pulled those out of the tab they
  live in and mixed a daily trade cap in with "am I calm enough to trade",
  which are different questions asked at different moments.

  Rules also record adherence after the fact ("did I follow it?"). This is
  asked before entry and answers yes/no about the trader's own state, so it
  gets its own table rather than being bent into one that means something else.

  Mirrors trading_confluences: same RLS shape, same enabled/order_index model,
  and a per-entry join table so answers attach to the day they were given.
*/

CREATE TABLE IF NOT EXISTS psychology_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entry_psychology_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  check_id uuid NOT NULL REFERENCES psychology_checks(id) ON DELETE CASCADE,
  -- Confirmed before entry. Null means the trader never answered, which is
  -- different from answering no - one is silence, the other is an admission.
  confirmed boolean,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (journal_entry_id, check_id)
);

CREATE INDEX IF NOT EXISTS psychology_checks_user_idx
  ON psychology_checks(user_id, order_index);
CREATE INDEX IF NOT EXISTS journal_entry_psychology_checks_entry_idx
  ON journal_entry_psychology_checks(journal_entry_id);

ALTER TABLE psychology_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_psychology_checks ENABLE ROW LEVEL SECURITY;

-- Same shape as every other paid-feature table: own rows, active subscription.
CREATE POLICY "Users manage own psychology checks"
  ON psychology_checks FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND has_active_subscription())
  WITH CHECK (user_id = (SELECT auth.uid()) AND has_active_subscription());

/*
  Reached through the owning journal entry rather than carrying its own
  user_id, so ownership cannot drift out of step with the entry it belongs to.
*/
CREATE POLICY "Users manage own psychology check answers"
  ON journal_entry_psychology_checks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
        AND je.user_id = (SELECT auth.uid())
    ) AND has_active_subscription()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
        AND je.user_id = (SELECT auth.uid())
    ) AND has_active_subscription()
  );
