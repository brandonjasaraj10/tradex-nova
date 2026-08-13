/*
  # Add Position Size to Journal Entries

  ## Overview
  Adds a position size field to journal entries to track the size of trades or positions taken.
  
  ## Changes
  
  ### Updates to `journal_entries` table
  - `position_size` (text) - Size of the position (e.g., "1 lot", "100 shares", "0.5 BTC")
  - Allows users to track and analyze their position sizing strategy
  
  ## Notes
  - Field is nullable for flexibility as not all entries are trade-related
  - Stored as text to allow flexible formats (lots, shares, units, contracts, etc.)
  
  ## Security
  - No changes to RLS policies needed (inherits from existing policies)
*/

-- Add position_size column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'position_size'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN position_size text;
  END IF;
END $$;

-- Add comment to document the field
COMMENT ON COLUMN journal_entries.position_size IS 
'Position size for the trade. Flexible format to accommodate different instruments (e.g., lots, shares, units, contracts).';