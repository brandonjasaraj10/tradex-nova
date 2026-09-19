/*
  Keep the parts of a synced trade we were throwing away.

  MetaStats returns pips, gain, durationInMinutes and a won/lost flag on
  every trade, and the sync was reading four fields and discarding the rest.
  They are the difference between Nova knowing what a trader made and Nova
  knowing how they traded.

  Why each one, since a column with no reason is a column nobody dares
  delete:

    pips - cannot be derived from what we store. Working it out needs the
    instrument's pip size, which varies by symbol and broker. It is also the
    only measure that compares a EURUSD trade to a USDJPY one fairly, since
    profit alone just says who was betting more.

    gain_percent - the trade's return against account equity at the time.
    Cannot be derived either: it needs the balance as it was that day, which
    we do not keep a history of. This is what makes "you risk more after a
    loss" answerable.

    duration_minutes - derivable from the timestamps, stored anyway because
    it is the broker's own figure and it saves every consumer redoing the
    arithmetic. Average hold time, and whether it collapses during a losing
    run, both start here.

  Deliberately not added: a won/lost column. The sign of pnl already says it,
  and a second source of the same truth is a chance for the two to disagree.
*/

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS pips numeric,
  ADD COLUMN IF NOT EXISTS gain_percent numeric,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMENT ON COLUMN public.trades.pips IS
  'Pips gained or lost, as reported by the broker. NULL for manual and CSV trades.';
COMMENT ON COLUMN public.trades.gain_percent IS
  'Return on account equity at the time of the trade, per the broker. NULL for manual and CSV trades.';
COMMENT ON COLUMN public.trades.duration_minutes IS
  'How long the position was open, per the broker.';
