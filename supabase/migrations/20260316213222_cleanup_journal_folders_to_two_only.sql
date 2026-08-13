/*
  # Clean Up Journal Folders - Keep Only Daily Journal and Notes

  ## Overview
  This migration removes all extra journal folders and ensures each user has exactly two folders:
  1. **Daily Journal** - For daily trading entries
  2. **Notes** - For general notes and documentation

  ## Changes
  1. Delete all duplicate folders
  2. Delete psychology, trades, and other template folders
  3. Ensure only one "Daily Journal" and one "Notes" folder per user
  4. Update the default folder creation function to be idempotent

  ## Security
  - Uses existing RLS policies
  - Preserves user data integrity
*/

-- First, delete all psychology and trade folders
DELETE FROM journal_folders 
WHERE template_type IN ('psychology', 'trade');

-- Delete duplicate Daily Journal folders (keep the oldest one per user)
DELETE FROM journal_folders f1
WHERE name = 'Daily Journal'
AND EXISTS (
  SELECT 1 FROM journal_folders f2
  WHERE f2.user_id = f1.user_id
  AND f2.name = 'Daily Journal'
  AND f2.created_at < f1.created_at
);

-- Delete duplicate Notes folders (keep the oldest one per user)
DELETE FROM journal_folders f1
WHERE name = 'Notes'
AND EXISTS (
  SELECT 1 FROM journal_folders f2
  WHERE f2.user_id = f1.user_id
  AND f2.name = 'Notes'
  AND f2.created_at < f1.created_at
);

-- Update Daily Journal template_type to 'default' for consistency
UPDATE journal_folders 
SET template_type = 'default'
WHERE name = 'Daily Journal' AND template_type != 'default';

-- Update the function to be idempotent and only create missing folders
CREATE OR REPLACE FUNCTION create_default_journal_folders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create Daily Journal folder if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM journal_folders
    WHERE user_id = NEW.id AND name = 'Daily Journal'
  ) THEN
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
  END IF;

  -- Create Notes folder if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM journal_folders
    WHERE user_id = NEW.id AND name = 'Notes'
  ) THEN
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
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill missing folders for existing users
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
      WHERE user_id = user_record.id AND name = 'Daily Journal'
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

    -- Add Notes if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM journal_folders 
      WHERE user_id = user_record.id AND name = 'Notes'
    ) THEN
      INSERT INTO journal_folders (user_id, name, description, icon, color, order_index, template_type)
      VALUES (
        user_record.id,
        'Notes',
        'General notes and documentation',
        'file-text',
        '#3B82F6',
        1,
        'notes'
      );
    END IF;
  END LOOP;
END;
$$;
