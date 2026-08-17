/*
  # Associate journal entries with a specific trading account

  ## Problem
  journal_entries had no way to record which account an entry belonged
  to at all - the JournalEntry type declared a broker_connection_id
  field, but it was never wired up anywhere and the live table never
  had that column (or any account column). Once a user has more than
  one account, there was no way to tell which account an entry came
  from, and the Journal page had no account selector at all (unlike
  Dashboard/Analytics/Calendar, which already filter by account via
  trades.broker_id).

  ## Fix
  Add account_id, pointing at broker_connections (the real base table
  behind the user_broker_connections view accounts are read from
  elsewhere in the app). Nullable and ON DELETE SET NULL - an entry
  isn't required to belong to an account (matches "All Accounts"
  entries with no association), and deleting an account shouldn't
  delete someone's journal entries.
*/

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES broker_connections(id) ON DELETE SET NULL;
