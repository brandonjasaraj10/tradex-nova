/*
  # Add unique constraint on journal folders

  Prevents duplicate folder names per user, which was causing duplicate
  "Daily Journal" and "Trades" folders to appear.

  1. Changes
    - Add unique constraint on (user_id, name) for journal_folders table

  2. Notes
    - Uses IF NOT EXISTS to be idempotent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_folders_user_id_name_key'
  ) THEN
    ALTER TABLE journal_folders ADD CONSTRAINT journal_folders_user_id_name_key UNIQUE (user_id, name);
  END IF;
END $$;
