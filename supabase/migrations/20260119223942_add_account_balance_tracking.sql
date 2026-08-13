/*
  # Add Account Balance Tracking System

  ## Summary
  Implements a complete account balance tracking system to support accurate analytics,
  psychology scoring, and Nova AI insights.

  ## Changes to user_broker_connections

  ### New Columns
  - `starting_balance` (numeric, required) - Initial account balance when account was created/connected
  - `currency` (text, default 'USD') - Account currency code (USD, EUR, GBP, etc.)
  - `ownership_type` (text with check constraint) - Account ownership: 'personal', 'funded', 'prop'
  - `current_balance` (numeric, computed) - Calculated as starting_balance + sum of closed trade P&L
  - `last_balance_update` (timestamptz) - Timestamp of last balance calculation

  ## Balance Calculation Logic
  - current_balance = starting_balance + sum(all closed trade P&L)
  - Only closed trades affect balance
  - Open trades do NOT affect balance
  - Recalculates on trade import, edit, or delete

  ## Notes
  - The existing `account_type` column (live, challenge, verification, funded) remains unchanged
  - New `ownership_type` column distinguishes between personal/funded/prop accounts
  - Manual balance adjustments are logged for audit purposes
*/

-- Add starting_balance column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'starting_balance'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN starting_balance numeric(20,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add currency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'currency'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN currency text DEFAULT 'USD' NOT NULL;
  END IF;
END $$;

-- Add ownership_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'ownership_type'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN ownership_type text DEFAULT 'personal' NOT NULL;
  END IF;
END $$;

-- Add check constraint for ownership_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_broker_connections_ownership_type_check'
  ) THEN
    ALTER TABLE user_broker_connections
      ADD CONSTRAINT user_broker_connections_ownership_type_check
      CHECK (ownership_type IN ('personal', 'funded', 'prop'));
  END IF;
END $$;

-- Add current_balance column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN current_balance numeric(20,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add last_balance_update column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'last_balance_update'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN last_balance_update timestamptz DEFAULT now();
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN user_broker_connections.starting_balance IS 'Initial account balance when account was created/connected';
COMMENT ON COLUMN user_broker_connections.currency IS 'Account currency code (USD, EUR, GBP, etc.)';
COMMENT ON COLUMN user_broker_connections.ownership_type IS 'Account ownership type: personal (own money), funded (prop firm funded), prop (prop firm general)';
COMMENT ON COLUMN user_broker_connections.current_balance IS 'Calculated balance: starting_balance + sum of all closed trade P&L';
COMMENT ON COLUMN user_broker_connections.last_balance_update IS 'Timestamp of last balance calculation';

-- Create function to calculate account balance
CREATE OR REPLACE FUNCTION calculate_account_balance(connection_id uuid)
RETURNS numeric AS $$
DECLARE
  starting_bal numeric;
  total_pnl numeric;
  calculated_balance numeric;
BEGIN
  -- Get starting balance
  SELECT starting_balance INTO starting_bal
  FROM user_broker_connections
  WHERE id = connection_id;

  -- Calculate total P&L from closed trades only
  SELECT COALESCE(SUM(profit_loss), 0) INTO total_pnl
  FROM trades
  WHERE broker_connection_id = connection_id
    AND status = 'closed';

  -- Calculate current balance
  calculated_balance := COALESCE(starting_bal, 0) + COALESCE(total_pnl, 0);

  -- Update the connection with new balance
  UPDATE user_broker_connections
  SET current_balance = calculated_balance,
      last_balance_update = now()
  WHERE id = connection_id;

  RETURN calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to recalculate balance when trades change
CREATE OR REPLACE FUNCTION trigger_recalculate_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate balance for the affected connection
  IF TG_OP = 'DELETE' THEN
    IF OLD.broker_connection_id IS NOT NULL THEN
      PERFORM calculate_account_balance(OLD.broker_connection_id);
    END IF;
  ELSE
    IF NEW.broker_connection_id IS NOT NULL THEN
      PERFORM calculate_account_balance(NEW.broker_connection_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS trigger_trades_balance_update ON trades;
CREATE TRIGGER trigger_trades_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_balance();

-- Create table for balance adjustment history (for manual adjustments and deposits/withdrawals)
CREATE TABLE IF NOT EXISTS balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES user_broker_connections(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL, -- 'deposit', 'withdrawal', 'manual_correction'
  amount numeric(20,2) NOT NULL,
  previous_balance numeric(20,2) NOT NULL,
  new_balance numeric(20,2) NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Create index for balance adjustments
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user_id ON balance_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_broker_connection_id ON balance_adjustments(broker_connection_id);

-- Enable RLS on balance_adjustments
ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for balance_adjustments
CREATE POLICY "Users can view own balance adjustments"
  ON balance_adjustments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own balance adjustments"
  ON balance_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Initialize current_balance for existing connections
UPDATE user_broker_connections
SET current_balance = starting_balance,
    last_balance_update = now()
WHERE current_balance = 0 AND starting_balance > 0;
