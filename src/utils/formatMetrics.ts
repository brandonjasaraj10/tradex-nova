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
