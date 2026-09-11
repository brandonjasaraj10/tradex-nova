/*
  One reading of a MetaStats trade, shared by both sync paths.

  It existed twice: once in metaapi-sync, which runs when a trader presses
  Sync, and once in sync-all-accounts, which runs on a schedule. Two copies
  of the same mapping means every future field has to be added twice and
  stays correct only as long as somebody remembers. That is exactly how the
  grace-period test drifted out of step with the rule it claimed to describe,
  passing while the real behaviour had inverted.

  So this is the only place that decides what a MetaStats trade becomes.
*/

export interface MetaStatsTrade {
  _id?: string;
  positionId?: string;
  symbol?: string;
  type?: string;
  volume?: number;
  openPrice?: number;
  closePrice?: number;
  openTime?: string;
  closeTime?: string;
  profit?: number;
  /* Pips, the trade's return on equity, and how long it was held. */
  pips?: number;
  gain?: number;
  durationInMinutes?: number;
}

export interface TradeRow {
  user_id: string;
  broker_id: string;
  external_id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  quantity: number;
  entry_price: number;
  exit_price: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  pips: number | null;
  gain_percent: number | null;
  duration_minutes: number | null;
}

/* A number, or null - never 0 standing in for "the broker didn't say". */
const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/*
  A balance movement rather than a trade: a deposit, a withdrawal, a prop
  firm crediting an account. MetaTrader records these as deals, they carry
  no symbol, and counting one as a trade puts a $200,000 "win" in the
  journal on the day an account was funded.
*/
export function isBalanceMovement(t: MetaStatsTrade): boolean {
  const dealType = String(t.type ?? "").toUpperCase();
  return !t.symbol || dealType.includes("BALANCE") || dealType.includes("CREDIT");
}

/*
  Returns null for anything that is not a completed trade: balance
  movements, and positions still open, which have no close time and no final
  profit and belong on a live view rather than in a record of what happened.
*/
export function toTradeRow(
  t: MetaStatsTrade,
  userId: string,
  connectionId: string,
): TradeRow | null {
  if (isBalanceMovement(t)) return null;

  const externalId = t._id ?? t.positionId;
  if (!externalId || !t.symbol || !t.openTime || !t.closeTime) return null;

  const dealType = String(t.type ?? "").toUpperCase();

  return {
    user_id: userId,
    broker_id: connectionId,
    external_id: String(externalId),
    symbol: t.symbol,
    direction: dealType.includes("SELL") ? "SHORT" : "LONG",
    quantity: Number(t.volume ?? 0),
    entry_price: Number(t.openPrice ?? 0),
    exit_price: Number(t.closePrice ?? 0),
    entry_date: new Date(t.openTime).toISOString(),
    exit_date: new Date(t.closeTime).toISOString(),
    pnl: Number(t.profit ?? 0),
    pips: numberOrNull(t.pips),
    gain_percent: numberOrNull(t.gain),
    duration_minutes: numberOrNull(t.durationInMinutes),
  };
}
