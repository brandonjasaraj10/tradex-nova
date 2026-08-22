/*
  Account balance must count journal-logged P&L, not just imported trades.

  calculate_account_balance() summed trades.pnl only. But logging a result
  as a journal entry with manual_pnl is the app's primary flow - it is how
  someone who does not import a CSV records a day - and the dashboard,
  calendar and analytics all already treat those entries as real P&L.

  The balance did not. Found on a real account: "Test Eval" displayed
  $100,000 with $5,000 of journal P&L against it, and no amount of pressing
  refresh would have changed that, because the number it recomputes was
  never counting those entries in the first place. For a user who journals
  rather than imports, the balance never moved at all.

  Both sources are summed now, matched to the account the same way each
  feature already matches them: trades by broker_id, journal entries by
  account_id.
*/

CREATE OR REPLACE FUNCTION public.calculate_account_balance(connection_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_new_balance numeric;
BEGIN
  UPDATE broker_connections bc
  SET current_balance = bc.starting_balance
        + COALESCE((
            SELECT SUM(t.pnl) FROM trades t
            WHERE t.broker_id = bc.id AND t.user_id = bc.user_id
          ), 0)
        + COALESCE((
            SELECT SUM(je.manual_pnl) FROM journal_entries je
            WHERE je.account_id = bc.id AND je.user_id = bc.user_id
          ), 0),
      last_balance_update = now()
  WHERE bc.id = connection_id
  RETURNING current_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$function$;

/*
  Backfill every existing account, so balances are correct immediately
  rather than only after each user happens to press refresh.
*/
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.broker_connections LOOP
    PERFORM public.calculate_account_balance(r.id);
  END LOOP;
END $$;
