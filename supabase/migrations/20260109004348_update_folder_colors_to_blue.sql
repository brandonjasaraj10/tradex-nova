/*
  # Update All Default Folder Colors to Blue

  ## Overview
  Updates all three default journal folders to use the same blue color (#3B82F6)
  for a consistent, cohesive look across the journal interface.

  ## Changes
  - Updates existing Daily Journal folders from green to blue
  - Updates existing Psychology Journal folders from purple to blue
  - Notes folders already use blue, so no change needed

  ## Color Update
  - All folders now use: "#3B82F6" (blue)

  ## Security
  - Uses existing RLS policies on journal_folders table
*/

-- Update Daily Journal folders to blue
UPDATE journal_folders
SET color = '#3B82F6'
WHERE name = 'Daily Journal' AND color != '#3B82F6';

-- Update Psychology Journal folders to blue
UPDATE journal_folders
SET color = '#3B82F6'
WHERE name = 'Psychology Journal' AND color != '#3B82F6';