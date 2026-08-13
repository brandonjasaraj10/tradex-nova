/*
  # Add linked entry support for psychology journal

  1. Changes
    - Add `linked_entry_id` column to journal_entries table
    - This allows one-to-one relationships between daily journal entries and psychology entries
    - Each psychology entry can be linked to its corresponding daily/trade journal entry
    
  2. Security
    - No RLS changes needed (inherits existing policies)
    
  3. Purpose
    - Enable multiple psychology entries per day, each linked to a specific journal entry
    - Support bidirectional syncing between linked entries
*/

-- Add linked_entry_id column to create relationships between entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'linked_entry_id'
  ) THEN
    ALTER TABLE journal_entries 
    ADD COLUMN linked_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL;
    
    -- Add index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_journal_entries_linked_entry_id 
    ON journal_entries(linked_entry_id);
  END IF;
END $$;