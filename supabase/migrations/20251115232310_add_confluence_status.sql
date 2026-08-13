/*
  # Add Status Field to Trading Confluences

  1. Changes
    - Add `present` boolean column to `journal_entry_confluences` table
    - Keep `checked` for backward compatibility (will represent "interacted with")
    - `present = true` means confluence was present (green)
    - `present = false` means confluence was violated/absent (red)
    - `present = null` means not checked/unmarked (gray)
  
  2. Security
    - No RLS changes needed (inherits from existing policies)
*/

-- Add present column to track three states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entry_confluences' AND column_name = 'present'
  ) THEN
    ALTER TABLE journal_entry_confluences ADD COLUMN present boolean;
  END IF;
END $$;