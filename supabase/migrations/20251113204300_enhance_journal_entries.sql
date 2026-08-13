/*
  # Enhance Journal Entries

  ## Overview
  Adds additional fields to journal entries to support trading journal features including
  screenshots, pre/post market thoughts, and enhanced trade documentation.

  ## Changes
  
  ### Updates to `journal_entries` table
  - `before_screenshots` (text array) - URLs of screenshots before entering trade
  - `after_screenshots` (text array) - URLs of screenshots after exiting trade
  - `pre_market_notes` (text) - Thoughts and analysis before market open
  - `post_market_notes` (text) - Reflection after market close
  - `custom_sections` (jsonb) - Flexible custom sections for user-defined content

  ## Notes
  - Screenshots stored as URLs (user can upload to Supabase storage)
  - Custom sections allow users to add their own labeled text areas
  - All new fields are nullable for flexibility
*/

-- Add new columns to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'before_screenshots'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN before_screenshots text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'after_screenshots'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN after_screenshots text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'pre_market_notes'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN pre_market_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'post_market_notes'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN post_market_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'custom_sections'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN custom_sections jsonb DEFAULT '[]';
  END IF;
END $$;