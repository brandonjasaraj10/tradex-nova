/*
  # Fix Security and Performance Issues

  1. Fixes for Unindexed Foreign Keys
    - Add index on trades.user_id (for foreign key constraint)
    - Add index on broker_connections.user_id (for foreign key constraint)

  2. Fixes for Auth RLS Performance
    - Replace auth.uid() with (select auth.uid()) in all RLS policies for both trades and broker_connections tables
    - This prevents re-evaluation of auth functions for each row

  3. Fixes for Function Search Path
    - Add SECURITY DEFINER and SET search_path to update_updated_at_column function

  4. Note on Unused Indexes
    - idx_broker_connections_user_id and idx_trades_broker_id are covering indexes for foreign keys
    - They will be used by PostgreSQL during foreign key constraint checks
    - These are expected to exist and are necessary for performance
*/

-- Fix unindexed foreign keys by creating indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_id ON broker_connections(user_id);

-- Drop old RLS policies with suboptimal auth function calls
DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
DROP POLICY IF EXISTS "Users can update own trades" ON trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON trades;

DROP POLICY IF EXISTS "Users can view own broker connections" ON broker_connections;
DROP POLICY IF EXISTS "Users can insert own broker connections" ON broker_connections;
DROP POLICY IF EXISTS "Users can update own broker connections" ON broker_connections;
DROP POLICY IF EXISTS "Users can delete own broker connections" ON broker_connections;

-- Recreate RLS policies with optimized auth function calls using (select auth.uid())
CREATE POLICY "Users can view own trades"
  ON trades
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own trades"
  ON trades
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own trades"
  ON trades
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own trades"
  ON trades
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Recreate broker_connections policies with optimized auth function calls
CREATE POLICY "Users can view own broker connections"
  ON broker_connections
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own broker connections"
  ON broker_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own broker connections"
  ON broker_connections
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own broker connections"
  ON broker_connections
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix function search path mutability by dropping trigger first, then function
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE
  ON trades
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();