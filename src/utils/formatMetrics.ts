/*
  One definition for how trading metrics are written, because the same
  metric was being formatted differently in each place it appeared.

  Profit factor is gross profit divided by gross loss - a ratio, not an
  amount. It stays a ratio deliberately: every tool a trader already uses
  (MT4/5, TradingView, TraderSync, prop-firm dashboards) reports it that
  way, the monetary version of the same idea is just Net P&L which is
  already shown alongside it, and the ratio carries information P&L cannot -
  two traders both up $5,000 are doing very different things at 1.1 versus
  3.0.

  The awkward case is a trader with no losing trades at all. There is no
  ratio to state - the denominator is zero - and the codebase had three
  different answers for it: novaScore substituted the literal 10, trades.ts
  returned Infinity, and the pages rendered that as "---". So the same
  account could read "10.00" on one screen and "---" on another, and neither
  told the user anything true.

  It renders as an em dash. These values sit in large bold slots sized for
  "1.38", so the earlier wording - "No losses yet" - wrapped onto three lines
  and read as something being broken. The dash says "not applicable" at a
  glance and stays the same size as a number; where the reason is worth
  giving, the tile carries it as a caption underneath instead.
*/

// novaScore.ts substitutes this when there is no loss to divide by. It is a
// sentinel, not a measurement, so it must never be printed as a ratio.
const NO_LOSS_SENTINEL = 10;

export const NO_LOSS_LABEL = 'No losses yet';

/** True when there is no loss to divide by, so callers can caption it. */
export function isNoLossCase(value: number | null | undefined, totalTrades = 1): boolean {
  if (value === null || value === undefined || totalTrades === 0) return false;
  return !isFinite(value) || value >= NO_LOSS_SENTINEL;
}

export function formatProfitFactor(value: number | null | undefined, totalTrades = 1): string {
  if (value === null || value === undefined || totalTrades === 0) return '--';
  if (isNoLossCase(value, totalTrades)) return '\u2014';
  return value.toFixed(2);
}

export function formatRatio(value: number | null | undefined, totalTrades = 1): string {
  if (value === null || value === undefined || totalTrades === 0) return '--';
  if (isNoLossCase(value, totalTrades)) return '\u2014';
  return value.toFixed(2);
}

/*
  Writes the window a set of figures covers, for display under their heading.

  This exists because two screens legitimately showed different values for
  the same named metric - profit factor read 1.62 in the all-time score panel
  and 2.24 on a tile covering the last 30 days - and with nothing stating the
  window, the only sensible reading was that one of them was broken. Naming
  the period is what makes an honest difference legible.
*/
export function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

/*
  The "x:1" form of a win/loss ratio.

  Separate from formatRatio because the no-loss case has to drop the suffix
  as well as the number - "No losses yet:1" is not a thing anyone should
  read. Same reason the callers cannot just append ":1" themselves.
*/
export function formatWinLossRatio(value: number | null | undefined, totalTrades = 1): string {
  const formatted = formatRatio(value, totalTrades);
  return /^[\d.]+$/.test(formatted) ? `${formatted}:1` : formatted;
}

/*
  Blue for a gain, grey for a loss - the app's colour rule, applied from the
  value rather than hard-coded per tile.

  Several stat tiles printed their number in blue unconditionally because the
  value "can't be negative": average win and best trade are computed from
  winning trades only, so today they are always zero or positive. That is a
  property of the current query, not of the tile, and nothing would catch it
  changing - a negative number would simply render in the colour that means
  profit. Deriving the colour from the value costs nothing and cannot drift.

  Zero counts as neutral: an account with no winning trades has not gained
  anything, so "$0.00" in gain-blue would overstate it.
*/
export function valueColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value) || value === 0) {
    return 'text-gray-400';
  }
  return value > 0 ? 'text-blue-400' : 'text-gray-400';
}

export type TradeOutcome = 'win' | 'loss' | 'breakeven';

/*
  Whether a position won, lost, or closed flat.

  Extracted rather than inlined because the interesting case is the boundary,
  and a boundary that lives inside a component cannot be tested without
  rendering it. Zero is breakeven, not a loss: a trade closed at exactly the
  entry price has not lost anything, and on a page someone uses to judge their
  own record, calling it a loss would misstate that record.

  Note this is a stricter reading than TradeTrendGlyph's, which draws anything
  not above zero with the falling grey line. That is a drawing of one trade;
  this is a label that gets counted and searched, so it is worth being exact.
*/
export function tradeOutcome(pnl: number): TradeOutcome {
  if (!isFinite(pnl) || pnl === 0) return 'breakeven';
  return pnl > 0 ? 'win' : 'loss';
}
