/*
  # Update Notes Folder Color to Blue

  ## Overview
  Changes the Notes folder color from gray to blue to match the style of other folders.

  ## Changes
  - Updates all Notes folders to use blue color (#3B82F6)
*/

UPDATE journal_folders
SET color = '#3B82F6'
WHERE name = 'Notes';