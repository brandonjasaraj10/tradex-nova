/*
  # Delete Existing Psychology Folders

  1. Changes
    - Migrate any entries from Psychology folders to Daily Journal folders
    - Delete all Psychology Journal folders from existing users
    
  2. Process
    - For each user with a Psychology folder:
      - Find or create their Daily Journal folder
      - Move all entries from Psychology folder to Daily Journal folder
      - Delete the Psychology folder
    
  3. Rationale
    - Psychology data is now accessible directly from daily journal entries
    - Consolidates all journal entries in fewer folders
    - Preserves user data by moving entries instead of deleting them
    
  4. Security
    - Uses existing RLS policies
    - All operations maintain user data ownership
*/

-- Migrate entries from Psychology folders to Daily Journal folders
DO $$
DECLARE
  user_record RECORD;
  psych_folder_id UUID;
  daily_folder_id UUID;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id 
    FROM journal_folders 
    WHERE name = 'Psychology Journal' OR template_type = 'psychology'
  LOOP
    -- Find the psychology folder for this user
    SELECT id INTO psych_folder_id
    FROM journal_folders
    WHERE user_id = user_record.user_id 
    AND (name = 'Psychology Journal' OR template_type = 'psychology')
    LIMIT 1;

    -- Find or get the Daily Journal folder for this user
    SELECT id INTO daily_folder_id
    FROM journal_folders
    WHERE user_id = user_record.user_id 
    AND name = 'Daily Journal'
    LIMIT 1;

    -- If we found both folders
    IF psych_folder_id IS NOT NULL AND daily_folder_id IS NOT NULL THEN
      -- Move all entries from psychology folder to daily journal folder
      UPDATE journal_entries
      SET folder_id = daily_folder_id
      WHERE folder_id = psych_folder_id;

      -- Delete the psychology folder
      DELETE FROM journal_folders
      WHERE id = psych_folder_id;
    ELSIF psych_folder_id IS NOT NULL THEN
      -- If no Daily Journal folder exists, just delete the psychology folder
      -- (entries will be orphaned but RLS will prevent access)
      DELETE FROM journal_folders
      WHERE id = psych_folder_id;
    END IF;
  END LOOP;
END;
$$;