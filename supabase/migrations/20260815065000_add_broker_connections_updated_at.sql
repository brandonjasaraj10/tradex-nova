/*
  # Add missing updated_at column to broker_connections

  ## Problem
  Found while testing the calculate_account_balance fix. broker_connections
  has an update_updated_at_column() trigger (BEFORE UPDATE, sets
  NEW.updated_at = now()) but no updated_at column at all - so every
  single UPDATE on this table has been failing outright with
  "record 'new' has no field 'updated_at'". This silently broke
  EditBalanceModal's balance updates too, not just the new RPC.

  ## Fix
  Add the column the trigger already expects - matches the same
  updated_at convention every other table in this app already uses.
*/

ALTER TABLE broker_connections ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
