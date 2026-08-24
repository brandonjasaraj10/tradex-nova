/*
  position_size becomes text, which is what the rest of the app already
  assumed.

  The TypeScript interface types it as string, the form's own placeholder
  reads "e.g., 1 lot, 100 shares", and every prompt that fills it gives
  examples with units. Only the column was numeric, so the unit was parsed
  off on the way in: "0.5 lots" was stored as 0.5 and "2%" as 2, which is
  indistinguishable from 2 lots. A trader who said they risked 2% got a
  journal entry claiming a position size of 2.

  Nothing calculates with this column - analyze-trading-performance passes it
  straight through for display - so widening it costs nothing and loses no
  data. Existing numeric values become their own string form.
*/
ALTER TABLE journal_entries
  ALTER COLUMN position_size TYPE text
  USING position_size::text;
