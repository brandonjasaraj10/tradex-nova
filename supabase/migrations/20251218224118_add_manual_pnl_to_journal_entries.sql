/*
  # Add Manual P&L Field to Journal Entries

  ## Overview
  Adds a field for users to manually enter their profit or loss for the day in their journal entries.

  ## Changes
  
  ### Updates to `journal_entries` table
  - Add `manual_pnl` (numeric) - Manual profit/loss entry for the day
  
  ## Notes
  - Field is nullable to allow entries without P&L data
  - Separate from automated trade P&L calculations
  - Users can record daily P&L directly in their journal
  
  ## Security
  - No changes to RLS policies needed (inherits from existing policies)
*/

-- Add manual_pnl column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'manual_pnl'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN manual_pnl numeric(15, 2);
  END IF;
END $$;

-- Add comment to document the field
COMMENT ON COLUMN journal_entries.manual_pnl IS 
'Manual profit/loss entry for the day. Separate from automated trade calculations, allows users to record their daily P&L directly in the journal.';