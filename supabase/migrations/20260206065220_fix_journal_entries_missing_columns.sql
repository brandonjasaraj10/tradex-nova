/*
  # Fix journal_entries missing columns

  The journal_entries table is missing several columns that the frontend code requires.
  The DB currently has mood_before/mood_after (integers) but the app uses a single mood (text) field.
  Screenshot columns, pre/post market notes, and custom_sections are also missing.

  1. Modified Tables
    - `journal_entries`
      - `mood` (text) - Single mood field used by the journal editor
      - `before_screenshots` (jsonb) - Array of {url, label} objects for before-trade screenshots
      - `after_screenshots` (jsonb) - Array of {url, label} objects for after-trade screenshots
      - `pre_market_notes` (text) - Pre-market analysis notes
      - `post_market_notes` (text) - Post-market review notes
      - `custom_sections` (jsonb) - Custom user-defined sections

  2. Notes
    - Uses IF NOT EXISTS checks to avoid errors on re-run
    - Does not drop existing mood_before/mood_after columns to preserve data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'mood'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN mood text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'before_screenshots'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN before_screenshots jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'after_screenshots'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN after_screenshots jsonb DEFAULT '[]'::jsonb;
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
    ALTER TABLE journal_entries ADD COLUMN custom_sections jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
