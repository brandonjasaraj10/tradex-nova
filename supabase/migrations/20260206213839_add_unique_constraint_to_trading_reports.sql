/*
  # Add unique constraint to trading_reports

  1. Changes
    - Adds unique constraint on (user_id, report_type, period_start)
    - Prevents duplicate reports for the same user, type, and period
    - Cleans up any existing duplicate reports first
  
  2. Security
    - No RLS changes
*/

DO $$
BEGIN
  DELETE FROM trading_reports a
  USING trading_reports b
  WHERE a.id > b.id
    AND a.user_id = b.user_id
    AND a.report_type = b.report_type
    AND a.period_start = b.period_start;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_reports_user_type_period_unique'
  ) THEN
    ALTER TABLE trading_reports
      ADD CONSTRAINT trading_reports_user_type_period_unique
      UNIQUE (user_id, report_type, period_start);
  END IF;
END $$;
