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

/*
  What MetaTrader's deal history adds to a trade, keyed by position id.

  Two things MetaStats does not give us: how the position ended, and what it
  cost to run.
*/
export interface DealEnrichment {
  close_reason: string | null;
  commission: number | null;
  swap: number | null;
  /*
    True UTC, taken from the deal's own `time` field.

    MetaStats reports openTime and closeTime in BROKER time, with no offset
    on the string - "2026-03-20 05:05:24.718". Parsing that as UTC stores a
    trade at the wrong instant by however far the broker's server sits from
    UTC, which was +3 hours on the account this was found on. It then puts
    trades on the wrong calendar day, which matters now that a trade belongs
    to the day it closed.

    The deal history carries both: `time` is a proper UTC instant and
    `brokerTime` is the same string MetaStats gives. Taking `time` removes
    the guesswork entirely - no timezone has to be inferred for anybody.
  */
  open_utc: string | null;
  close_utc: string | null;
}

export interface MetaApiDeal {
  positionId?: string;
  entryType?: string;
  reason?: string;
  commission?: number;
  swap?: number;
  /* A real UTC instant, unlike MetaStats' broker-time strings. */
  time?: string;
}

/*
  MetaTrader's reason codes, reduced to what a trader would say happened.

  stop_loss and take_profit are the valuable ones: for those, the exit price
  is where that level sat, which is the only way to recover a stop or target
  from history - MetaTrader records neither on the entry order.
*/
function readCloseReason(reason: string | undefined): string | null {
  switch (reason) {
    case "DEAL_REASON_SL":
      return "stop_loss";
    case "DEAL_REASON_TP":
      return "take_profit";
    case "DEAL_REASON_CLIENT":
    case "DEAL_REASON_MOBILE":
    case "DEAL_REASON_WEB":
      return "manual";
    case "DEAL_REASON_EXPERT":
      return "expert";
    case "DEAL_REASON_SO":
      return "stop_out";
    default:
      return null;
  }
}

/*
  Deals to a per-position summary.

  Commission and swap are summed across every deal on the position, because
  a broker charges on the way in and again on the way out, and a partial
  close adds more. The close reason comes from the deal that closed the
  position - DEAL_ENTRY_OUT - since the opening deal only ever says how the
  trade was entered.
*/
export function summariseDeals(deals: MetaApiDeal[]): Map<string, DealEnrichment> {
  const byPosition = new Map<string, DealEnrichment>();

  for (const d of deals) {
    const positionId = d.positionId;
    if (!positionId) continue;

    const current = byPosition.get(positionId) ??
      { close_reason: null, commission: null, swap: null,
        open_utc: null, close_utc: null };

    if (typeof d.commission === "number" && Number.isFinite(d.commission)) {
      current.commission = (current.commission ?? 0) + d.commission;
    }
    if (typeof d.swap === "number" && Number.isFinite(d.swap)) {
      current.swap = (current.swap ?? 0) + d.swap;
    }
    /*
      A position opens once and can close in several parts. The open is the
      earliest IN deal, the close the latest OUT deal, so a partially closed
      position reports the span it was actually held.
    */
    const entryType = String(d.entryType ?? "").toUpperCase();
    if (entryType.includes("OUT")) {
      current.close_reason = readCloseReason(d.reason) ?? current.close_reason;
      if (d.time && (!current.close_utc || d.time > current.close_utc)) {
        current.close_utc = d.time;
      }
    } else if (entryType.includes("IN")) {
      if (d.time && (!current.open_utc || d.time < current.open_utc)) {
        current.open_utc = d.time;
      }
    }

    byPosition.set(positionId, current);
  }

  return byPosition;
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
  close_reason: string | null;
  commission: number | null;
  swap: number | null;
}

/*
  Pips, computed from the prices rather than taken from MetaStats.

  MetaStats' own `pips` field is pips multiplied by lot size. Measured
  against this account: 50 lots of AUDUSD moving 4.2 pips came back as 210,
  11.42 lots moving 7.9 came back as 90, 5.36 lots moving 29.4 came back as
  160. It scales with position size, so "you give up 269 pips on a stop"
  actually meant 269 pip-lots, which says more about bet size than about
  where the stop sat.

  The derived figure reconciles with the money exactly - 50 lots at -4.2
  pips is -$2,100 gross, and the broker charged -$2,100.00.

  Only forex gets a pip count. A futures contract moves in ticks, an index
  in points, a share in cents; MetaStats returns a number for all of them
  and calling any of it "pips" would be confidently wrong in a different way
  each time. Null is the honest answer there, and the price move is still on
  the row for anyone who wants it.
*/
function derivePips(
  symbol: string,
  entryPrice: number,
  exitPrice: number,
  direction: "LONG" | "SHORT",
): number | null {
  /*
    Broker suffixes are everywhere - EURUSD.sim, EURUSD.raw, EURUSDm - so
    the currency pair is read off the front rather than by matching the
    whole symbol.
  */
  const base = symbol.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  if (base.length !== 6 || !/^[A-Z]{6}$/.test(base)) return null;

  const CURRENCIES = new Set([
    "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD",
    "SEK", "NOK", "DKK", "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN", "CZK",
  ]);
  const quote = base.slice(3);
  if (!CURRENCIES.has(base.slice(0, 3)) || !CURRENCIES.has(quote)) return null;

  /* A yen pip is the second decimal, not the fourth. */
  const pipSize = quote === "JPY" ? 0.01 : 0.0001;

  const move = (exitPrice - entryPrice) / pipSize;
  /* Signed by whether the trade made money, so it agrees with pnl. */
  const signed = direction === "SHORT" ? -move : move;
  return Math.round(signed * 10) / 10;
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
  deals?: Map<string, DealEnrichment>,
): TradeRow | null {
  if (isBalanceMovement(t)) return null;

  const externalId = t._id ?? t.positionId;
  if (!externalId || !t.symbol || !t.openTime || !t.closeTime) return null;

  const dealType = String(t.type ?? "").toUpperCase();
  const enrichment = t.positionId ? deals?.get(String(t.positionId)) : undefined;

  return {
    user_id: userId,
    broker_id: connectionId,
    external_id: String(externalId),
    symbol: t.symbol,
    direction: dealType.includes("SELL") ? "SHORT" : "LONG",
    quantity: Number(t.volume ?? 0),
    entry_price: Number(t.openPrice ?? 0),
    exit_price: Number(t.closePrice ?? 0),
    /*
      The deal's UTC instant wherever we have it. Falling back to
      MetaStats' string keeps a trade importable when the deal history is
      unavailable, but that string is broker time and will be off by the
      server's offset - see DealEnrichment.open_utc.
    */
    entry_date: enrichment?.open_utc ?? new Date(t.openTime).toISOString(),
    exit_date: enrichment?.close_utc ?? new Date(t.closeTime).toISOString(),
    pnl: Number(t.profit ?? 0),
    /*
      Not numberOrNull(t.pips) - see derivePips. What MetaStats calls pips
      is pips times lot size.
    */
    pips: derivePips(
      t.symbol,
      Number(t.openPrice ?? 0),
      Number(t.closePrice ?? 0),
      dealType.includes("SELL") ? "SHORT" : "LONG",
    ),
    gain_percent: numberOrNull(t.gain),
    duration_minutes: numberOrNull(t.durationInMinutes),
    /*
      Left null rather than zeroed when the deal history was not fetched or
      did not cover this position. Nulls say "we don't know"; zeros would
      claim the trade was free.
    */
    close_reason: enrichment?.close_reason ?? null,
    commission: enrichment?.commission ?? null,
    swap: enrichment?.swap ?? null,
  };
}

export const METASTATS_URL = "https://metastats-api-v1.london.agiliumtrade.ai";

/* MetaStats wants "YYYY-MM-DD HH:mm:ss.SSS", not an ISO string. */
export const metaStatsTime = (d: Date) =>
  d.toISOString().replace("T", " ").replace("Z", "");

/*
  How far back a first sync reaches.

  It used to be one year, which quietly decided that a trader's history
  began twelve months ago. For somebody who has traded the same account
  for five years, importing the last twelve months of it is not a
  shortened import - it is a wrong one, because every statistic TradeX
  then shows is computed over an arbitrary slice they did not choose.

  The date matters less than the fact that it predates the platforms
  themselves: MT4 shipped in 2005 and MT5 in 2010, so nothing on either
  can have closed a trade before this and no history is cut off by it.

  This applies only to the first sync of an account. Afterwards the
  window is the last sync minus a day, which is the cheap incremental
  case and stays that way.
*/
export const FULL_HISTORY_START = new Date("2000-01-01T00:00:00Z");

/*
  MetaStats returns at most 1000 trades per call - that is the documented
  ceiling on `limit`, not a default worth raising - so anything longer
  than a busy year needs paging through with `offset`.

  Without this, a deeper window silently returned the first 1000 trades
  and nothing said so. That is the failure worth designing against here:
  not an error, but a quietly incomplete import that looks exactly like a
  complete one.
*/
const PAGE_SIZE = 1000;

/*
  A stop, so a broken account cannot loop forever. 50 pages is 50,000
  trades - far past any human trading record, and reached only by a bot
  account or a bug. Hitting it is reported rather than swallowed.
*/
const MAX_PAGES = 50;

export async function fetchHistoricalTrades(
  token: string,
  metaapiAccountId: string,
  since: Date,
  until: Date,
): Promise<{ trades: MetaStatsTrade[]; truncated: boolean; pages: number }> {
  const all: MetaStatsTrade[] = [];
  let page = 0;

  for (; page < MAX_PAGES; page++) {
    /*
      updateHistory only on the first page. It is what makes MetaStats go
      and refresh from the broker, and asking it to do that again for
      every page of the same window is work nobody reads.
    */
    const url =
      `${METASTATS_URL}/users/current/accounts/${metaapiAccountId}` +
      `/historical-trades/${encodeURIComponent(metaStatsTime(since))}` +
      `/${encodeURIComponent(metaStatsTime(until))}` +
      `?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}` +
      (page === 0 ? "&updateHistory=true" : "");

    const res = await fetch(url, { headers: { "auth-token": token } });
    if (!res.ok) throw new Error(`MetaApi returned ${res.status}`);

    const payload = await res.json().catch(() => null) as
      | { trades?: MetaStatsTrade[] }
      | MetaStatsTrade[]
      | null;
    const batch: MetaStatsTrade[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.trades)
      ? payload!.trades!
      : [];

    all.push(...batch);

    // A short page is the last page.
    if (batch.length < PAGE_SIZE) {
      return { trades: all, truncated: false, pages: page + 1 };
    }
  }

  return { trades: all, truncated: true, pages: page };
}
