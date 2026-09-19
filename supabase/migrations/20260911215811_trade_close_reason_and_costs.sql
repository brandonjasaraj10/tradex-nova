/*
  How a trade ended, and what it cost to run.

  close_reason comes from the closing deal MetaTrader records, and it is the
  field that makes risk analysable. When a trade ends at a stop, the exit
  price IS where the stop was; when it ends at a target, the exit price is
  where the target was. Both follow from the same field, and between them
  they give the stop distance, the target distance, and therefore the reward
  to risk the trader actually achieved rather than the one they intended.

  MetaTrader records neither level on the entry order - both live on the
  position, and hitting one creates a new closing order - so this is the only
  way to recover them from history.

  Two things it cannot tell us, worth writing down before somebody assumes
  otherwise. It says nothing about the stop on a trade that was not stopped,
  so any average built from it describes realised losses rather than
  intended risk. And a gap or slippage means the fill can be worse than
  where the stop sat, so it is what the stop cost, not where it was placed.

  commission and swap are stored for the breakdown, NOT to be added to pnl.
  Measured against this account: a position with gross -2005.40 and
  commission -26.80 came back from MetaStats as profit -2032.20. The P&L we
  already store is net, to the cent. Adding costs again would double-count
  them and make the figures worse, which is the opposite of why they are
  here. Gross is pnl - commission - swap when anyone wants it.

  Worth having for its own sake: this account paid -4,389.54 in commission
  across 51 deals, and nothing in the app showed it.
*/

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS commission numeric,
  ADD COLUMN IF NOT EXISTS swap numeric;

COMMENT ON COLUMN public.trades.close_reason IS
  'How the position ended: stop_loss, take_profit, manual, expert. NULL when unknown or not synced. For stop_loss and take_profit the exit price is where that level sat.';
COMMENT ON COLUMN public.trades.commission IS
  'Commission charged, negative. Already included in pnl - do not add it again.';
COMMENT ON COLUMN public.trades.swap IS
  'Overnight financing, negative when charged. Already included in pnl.';
