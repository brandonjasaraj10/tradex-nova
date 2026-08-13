/*
  # Create Default Notes Folder for New Users

  ## Overview
  Automatically creates a default "Notes" folder for every new user that joins the platform.
  This provides users with an immediate place to document thoughts, ideas, and general notes
  similar to a Notion template.

  ## Changes
  1. New Function
    - `create_default_journal_folders()` - Creates default folders for a user
      - Creates a "Notes" folder with a document icon and neutral color
      - Can be extended to create additional default folders if needed

  2. New Trigger
    - Trigger on `user_profiles` table after insert
    - Automatically calls the function to create default folders
    - Runs for each new user that joins the platform

  ## Default Folder Details
  - **Name**: "Notes"
  - **Description**: "General notes and documentation"
  - **Icon**: "file-text" (document icon)
  - **Color**: "#6B7280" (neutral gray)
  - **Order**: 0 (appears first in the list)

  ## Security
  - Uses existing RLS policies on journal_folders table
  - Function runs with security definer to ensure proper permissions
*/

-- Function to create default journal folders for a new user
CREATE OR REPLACE FUNCTION create_default_journal_folders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create default "Notes" folder
  INSERT INTO journal_folders (user_id, name, description, icon, color, order_index)
  VALUES (
    NEW.id,
    'Notes',
    'General notes and documentation',
    'file-text',
    '#6B7280',
    0
  );

  RETURN NEW;
END;
$$;

-- Create trigger to automatically create default folders when a user profile is created
DROP TRIGGER IF EXISTS create_default_folders_on_user_creation ON user_profiles;
CREATE TRIGGER create_default_folders_on_user_creation
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_journal_folders();

-- Backfill: Create "Notes" folder for existing users who don't have any folders
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT up.id
    FROM user_profiles up
    LEFT JOIN journal_folders jf ON jf.user_id = up.id
    GROUP BY up.id
    HAVING COUNT(jf.id) = 0
  LOOP
    INSERT INTO journal_folders (user_id, name, description, icon, color, order_index)
    VALUES (
      user_record.id,
      'Notes',
      'General notes and documentation',
      'file-text',
      '#6B7280',
      0
    );
  END LOOP;
END;
$$;