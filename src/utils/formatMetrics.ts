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
  account could read "10.00" on one screen and "---" on another, and
  neither told the user anything true. It now says so in words.
*/

// novaScore.ts substitutes this when there is no loss to divide by. It is a
// sentinel, not a measurement, so it must never be printed as a ratio.
const NO_LOSS_SENTINEL = 10;

export function formatProfitFactor(value: number | null | undefined, totalTrades = 1): string {
  if (value === null || value === undefined || totalTrades === 0) return '--';
  if (!isFinite(value) || value >= NO_LOSS_SENTINEL) return 'No losses yet';
  return value.toFixed(2);
}

export function formatRatio(value: number | null | undefined, totalTrades = 1): string {
  if (value === null || value === undefined || totalTrades === 0) return '--';
  if (!isFinite(value) || value >= NO_LOSS_SENTINEL) return 'No losses yet';
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
