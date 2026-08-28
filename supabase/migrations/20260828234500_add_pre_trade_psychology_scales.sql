/*
  Three 1-5 self-ratings taken before entering a trade.

  Real columns rather than another key inside template_data, because the
  entire point of collecting these is to compare them against outcomes later
  - "do I lose money when I rate my focus at 2?" - and that question is a
  simple query against columns, versus digging through JSONB on every row.

  Nullable on purpose: an unanswered scale is not a zero. A trader who did not
  rate their confidence has told us nothing, and averaging that in as 0 would
  drag every summary toward a state they never reported.

  Separate from the existing psychology template in template_data, which is a
  long-form daily journal for psychology folders. This is the quick pre-entry
  check that sits on an ordinary trade entry.
*/
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS pre_trade_emotional_state smallint
    CHECK (pre_trade_emotional_state BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pre_trade_focus smallint
    CHECK (pre_trade_focus BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pre_trade_confidence smallint
    CHECK (pre_trade_confidence BETWEEN 1 AND 5);
