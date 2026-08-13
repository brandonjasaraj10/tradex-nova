/*
  # Update Notes Folder Creation Function

  ## Overview
  Updates the default folder creation function to:
  - Use blue color (#3B82F6) instead of gray
  - Set template_type to 'notes' for simplified interface

  ## Changes
  - Updates create_default_journal_folders() function
  - New Notes folders will have blue color and 'notes' template type
*/

CREATE OR REPLACE FUNCTION create_default_journal_folders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create default "Notes" folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
  VALUES (
    NEW.id,
    'Notes',
    'General notes and documentation',
    'file-text',
    '#3B82F6',
    0,
    'notes'
  );

  RETURN NEW;
END;
$$;