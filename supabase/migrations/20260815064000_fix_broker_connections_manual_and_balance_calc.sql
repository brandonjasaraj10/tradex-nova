/*
  # Fix broken manual account creation and balance recalculation (fix #10)

  ## Problem
  Two more broken pieces found while fixing manual account creation and
  CSV import (CLAUDE.md fix #10):

  1. broker_connections.credentials is NOT NULL with no default. Manual
     accounts (the only real, working account type - live broker API
     sync was never functional and has already been removed elsewhere
     this session) have no credentials to store, but every insert
     omitted the column entirely, so every manual "Add Account" attempt
     failed outright with a not-null constraint violation.

  2. EditBalanceModal.tsx calls a calculate_account_balance(connection_id)
     RPC function to recompute an account's current balance from its
     starting balance plus the P&L of its trades - but that function
     was never created. It's called and its error is handled gracefully
     (falls back to a "recalculation failed" message), so this wasn't a
     silent failure, but the balance recalculation feature described in
     the modal's own help text has never actually worked.

  ## Fix
  Default credentials to '{}'::jsonb (correct for accounts with no API
  credentials). Add the missing calculate_account_balance function -
  runs as the calling user (not SECURITY DEFINER) so the existing RLS
  policies on broker_connections and trades apply normally, same as
  everywhere else in this app.
*/

ALTER TABLE broker_connections ALTER COLUMN credentials SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION calculate_account_balance(connection_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  UPDATE broker_connections bc
  SET current_balance = bc.starting_balance + COALESCE((
        SELECT SUM(t.pnl) FROM trades t
        WHERE t.broker_id = bc.id AND t.user_id = bc.user_id
      ), 0),
      last_balance_update = now()
  WHERE bc.id = connection_id
  RETURNING current_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_account_balance(uuid) TO authenticated;
