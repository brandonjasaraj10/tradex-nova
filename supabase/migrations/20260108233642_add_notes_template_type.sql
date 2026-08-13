/*
  # Add Notes Template Type

  ## Overview
  Sets the template_type for Notes folders to 'notes' to distinguish them
  from other folders and provide a simpler, Notion-like interface.

  ## Changes
  - Updates all Notes folders to use template_type = 'notes'
*/

UPDATE journal_folders
SET template_type = 'notes'
WHERE name = 'Notes';