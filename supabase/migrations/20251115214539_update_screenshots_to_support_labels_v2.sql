/*
  # Update Screenshots to Support Labels

  ## Overview
  Updates the before_screenshots and after_screenshots columns to store objects
  with both url and label fields instead of just URL strings.

  ## Changes
  
  ### Updates to `journal_entries` table
  - Change `before_screenshots` from text[] to jsonb to support {url, label} objects
  - Change `after_screenshots` from text[] to jsonb to support {url, label} objects
  
  ## Migration Strategy
  - For existing data, convert string URLs to objects with url and a default label
  - This is a data-preserving migration
  
  ## Notes
  - Each screenshot is now stored as: { "url": "...", "label": "..." }
  - Allows users to add descriptive labels to their screenshots
  - Labels default to "Untitled" if not provided
*/

-- Backup and convert before_screenshots
DO $$
BEGIN
  -- Create a temporary column to hold the jsonb data
  ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS before_screenshots_new jsonb DEFAULT '[]'::jsonb;
  
  -- Migrate existing data from text[] to jsonb with labels
  UPDATE journal_entries
  SET before_screenshots_new = (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('url', value, 'label', 'Untitled')
      ),
      '[]'::jsonb
    )
    FROM unnest(before_screenshots) AS value
  )
  WHERE before_screenshots IS NOT NULL AND array_length(before_screenshots, 1) > 0;
  
  -- Drop old column and rename new one
  ALTER TABLE journal_entries DROP COLUMN IF EXISTS before_screenshots;
  ALTER TABLE journal_entries RENAME COLUMN before_screenshots_new TO before_screenshots;
END $$;

-- Backup and convert after_screenshots
DO $$
BEGIN
  -- Create a temporary column to hold the jsonb data
  ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS after_screenshots_new jsonb DEFAULT '[]'::jsonb;
  
  -- Migrate existing data from text[] to jsonb with labels
  UPDATE journal_entries
  SET after_screenshots_new = (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('url', value, 'label', 'Untitled')
      ),
      '[]'::jsonb
    )
    FROM unnest(after_screenshots) AS value
  )
  WHERE after_screenshots IS NOT NULL AND array_length(after_screenshots, 1) > 0;
  
  -- Drop old column and rename new one
  ALTER TABLE journal_entries DROP COLUMN IF EXISTS after_screenshots;
  ALTER TABLE journal_entries RENAME COLUMN after_screenshots_new TO after_screenshots;
END $$;
