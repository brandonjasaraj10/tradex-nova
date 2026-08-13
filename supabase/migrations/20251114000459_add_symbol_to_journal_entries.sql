/*
  # Add Symbol/Pair to Journal Entries

  ## Overview
  Adds symbol/pair tracking to journal entries to allow users to document which 
  trading symbol or currency pair they are analyzing or trading in their journal entries.

  ## Changes
  
  ### Updates to `journal_entries` table
  - `symbol` (text) - Trading symbol or currency pair (e.g., "AAPL", "EUR/USD", "BTC/USDT")
  
  ## Notes
  - Field is nullable as not all journal entries are trade-related
  - Allows users to filter and organize entries by symbol
  - Can be used with journal_trade_entries for comprehensive trade documentation
*/

-- Add symbol column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'symbol'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN symbol text;
  END IF;
END $$;

-- Create index for symbol filtering
CREATE INDEX IF NOT EXISTS idx_journal_entries_symbol ON journal_entries(symbol);
