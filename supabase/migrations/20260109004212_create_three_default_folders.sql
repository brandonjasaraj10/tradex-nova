/*
  # Create Three Default Journal Folders for All Users

  ## Overview
  Updates the default folder creation system to provide users with three essential folders:
  1. **Daily Journal** - For general daily trading reflections
  2. **Psychology Journal** - For mental and emotional tracking
  3. **Notes** - For general documentation and ideas

  ## Changes
  1. Function Updates
    - Updates `create_default_journal_folders()` to create all three folders
    - Each folder has appropriate icons, colors, and template types
    
  2. Backfill
    - Creates missing folders for existing users
    - Checks which folders already exist to avoid duplicates

  ## Default Folders
  - **Daily Journal**
    - Icon: "calendar"
    - Color: "#3B82F6" (blue)
    - Template: "default"
    - Order: 0

  - **Psychology Journal**
    - Icon: "brain"
    - Color: "#3B82F6" (blue)
    - Template: "psychology"
    - Order: 1

  - **Notes**
    - Icon: "file-text"
    - Color: "#3B82F6" (blue)
    - Template: "notes"
    - Order: 2

  ## Security
  - Uses existing RLS policies on journal_folders table
  - Function runs with SECURITY DEFINER for proper permissions
*/

-- Update function to create three default folders
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

  -- Create Psychology Journal folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
  VALUES (
    NEW.id,
    'Psychology Journal',
    'Track your mental and emotional states',
    'brain',
    '#3B82F6',
    1,
    'psychology'
  );

  -- Create Notes folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
  VALUES (
    NEW.id,
    'Notes',
    'General notes and documentation',
    'file-text',
    '#3B82F6',
    2,
    'notes'
  );

  RETURN NEW;
END;
$$;

-- Backfill: Create missing folders for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT id FROM user_profiles
  LOOP
    -- Add Daily Journal if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM journal_folders
      WHERE user_id = user_record.id
      AND name = 'Daily Journal'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (
        user_record.id,
        'Daily Journal',
        'Daily trading reflections and general entries',
        'calendar',
        '#3B82F6',
        0,
        'default'
      );
    END IF;

    -- Add Psychology Journal if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM journal_folders
      WHERE user_id = user_record.id
      AND name = 'Psychology Journal'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (
        user_record.id,
        'Psychology Journal',
        'Track your mental and emotional states',
        'brain',
        '#3B82F6',
        1,
        'psychology'
      );
    END IF;

    -- Add Notes if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM journal_folders 
      WHERE user_id = user_record.id 
      AND name = 'Notes'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (
        user_record.id,
        'Notes',
        'General notes and documentation',
        'file-text',
        '#3B82F6',
        2,
        'notes'
      );
    END IF;
  END LOOP;
END;
$$;