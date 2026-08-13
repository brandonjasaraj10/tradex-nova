/*
  # Add is_read field to notes table

  1. Changes
    - Add `is_read` (boolean) column to notes table
      - Defaults to false (new notes are unread)
    - Notes start as unread and can be marked as read by the user

  2. Notes
    - This allows users to track which notes they've reviewed
    - The "new" indicator will be shown for unread notes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notes ADD COLUMN is_read boolean DEFAULT false;
  END IF;
END $$;
