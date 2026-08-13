/*
  # Remove Psychology Folder

  1. Changes
    - Update `create_default_journal_folders()` function to only create Daily Journal and Notes folders
    - Remove Psychology Journal folder from being auto-created for new users
    - Note: Existing psychology folders are kept for users who have them
    
  2. Rationale
    - Psychology data is now accessible directly from daily journal entries via the psychology template
    - Eliminates redundant UI and simplifies the user experience
    - Users can still access psychology tracking through any journal entry
    
  3. Security
    - Uses existing RLS policies
    - Function runs with SECURITY DEFINER for proper permissions
*/

-- Update function to create only Daily Journal and Notes folders
CREATE OR REPLACE FUNCTION create_default_journal_folders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create Daily Journal folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
  VALUES (
    NEW.id,
    'Daily Journal',
    'Daily trading reflections and general entries',
    'calendar',
    '#3B82F6',
    0,
    'default'
  );

  -- Create Notes folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
  VALUES (
    NEW.id,
    'Notes',
    'General notes and documentation',
    'file-text',
    '#3B82F6',
    1,
    'notes'
  );

  RETURN NEW;
END;
$$;