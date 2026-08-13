/*
  # Add direction and broker connection to journal entries

  1. Modified Tables
    - `journal_entries`
      - `direction` (text, nullable) - Trade direction: 'LONG' or 'SHORT'
      - `broker_connection_id` (uuid, nullable) - Links journal entry to a specific trading account

  2. Important Notes
    - These columns allow journal entries to properly track trade direction for Analytics charts
    - The broker_connection_id allows filtering journal entries by trading account
    - Both columns are nullable to maintain backward compatibility with existing entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'direction'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN direction text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'broker_connection_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN broker_connection_id uuid REFERENCES broker_connections(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_direction ON journal_entries(direction);
CREATE INDEX IF NOT EXISTS idx_journal_entries_broker_connection_id ON journal_entries(broker_connection_id);