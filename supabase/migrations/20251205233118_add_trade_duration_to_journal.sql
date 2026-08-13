/*
  # Add Trade Duration to Journal Entries

  ## Overview
  Adds a trade duration field to journal entries to track how long trades were held.
  
  ## Changes
  
  ### Updates to `journal_entries` table
  - `trade_duration` (text) - Duration of the trade (e.g., "30 minutes", "2 hours", "3 days", "1 month")
  - Allows users to track and analyze their holding periods
  
  ## Notes
  - Field is nullable for flexibility as not all entries are trade-related
  - Stored as text to allow flexible duration formats (minutes, hours, days, weeks, months)
*/

-- Add trade_duration column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'trade_duration'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN trade_duration text;
  END IF;
END $$;