/*
  # Add Notes Folder to All Existing Users

  ## Overview
  Adds the "Notes" folder to all users who don't already have one.
  The previous migration only added it to users with zero folders,
  so this ensures all users get the Notes folder.

  ## Changes
  - Inserts "Notes" folder for all users who don't have one yet
  - Sets appropriate order_index to place it after existing folders
  - Prevents duplicate Notes folders with a conditional check
*/

-- Add "Notes" folder to all users who don't already have one
INSERT INTO journal_folders (user_id, name, description, icon, color, order_index)
SELECT 
  up.id,
  'Notes',
  'General notes and documentation',
  'file-text',
  '#6B7280',
  COALESCE(
    (SELECT MAX(order_index) + 1 FROM journal_folders WHERE user_id = up.id),
    0
  ) as order_index
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 
  FROM journal_folders jf 
  WHERE jf.user_id = up.id 
  AND jf.name = 'Notes'
);