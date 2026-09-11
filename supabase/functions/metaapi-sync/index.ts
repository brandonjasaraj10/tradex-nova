/*
  Pull closed trades from a connected MetaTrader account into the journal.

  Uses MetaStats rather than the raw deal history on purpose. MetaTrader
  records a trade as two or more separate deals - an entry, an exit, and
  another exit for every partial close - and stitching those back into
  round turns by position id is exactly the kind of code that looks right
  and quietly mis-reports someone's P&L. MetaStats hands back trades
  already paired, with the profit the broker itself calculated.

  Safe to run as often as we like. Every synced row carries the broker's
  own trade id and is upserted on it, so a hundred runs produce the same
  hundred trades, not a hundred copies. Manual and CSV-imported trades have
  no external id and are never touched.

  The window deliberately overlaps the last sync by a day. MetaStats works
  in the broker's timezone rather than ours, and an off-by-one-timezone
  window would silently drop trades around midnight - re-fetching a day is
  free and the upsert absorbs it.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  type MetaStatsTrade,
  isBalanceMovement,
  summariseDeals,
  toTradeRow,
} from "../_shared/metaStatsTrade.ts";

const METASTATS_URL = "https://metastats-api-v1.london.agiliumtrade.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/* MetaStats wants "YYYY-MM-DD HH:mm:ss.SSS", not ISO. */
const metaStatsTime = (d: Date) =>
  d.toISOString().replace("T", " ").replace("Z", "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const token = Deno.env.get("METAAPI_TOKEN");
  if (!token) {
    return json({ error: "Account syncing isn't configured yet." }, 503);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const connectionId = String(body?.connectionId ?? "").trim();
    if (!connectionId) return json({ error: "Which account?" }, 400);
    /*
      Diagnostic only: echoes what MetaStats actually sent instead of what
      we hoped it sent. Never on by default - it returns raw trade data.
    */
    const debug = body?.debug === true;
    const sinceDays = Number(body?.sinceDays) > 0 ? Number(body.sinceDays) : 365;

    const { data: connection, error: readError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id, metaapi_account_id, last_sync, starting_balance")
      .eq("id", connectionId)
      .maybeSingle();

    if (readError || !connection || connection.user_id !== user.id) {
      return json({ error: "Account not found." }, 404);
    }
    if (!connection.metaapi_account_id) {
      return json({ error: "That account isn't set up for syncing." }, 400);
    }

    /*
      First sync reaches back a year; later ones only need what's happened
      since, minus a day of overlap for the timezone reasons above.
    */
    const now = new Date();
    const explicitWindow = Number(body?.sinceDays) > 0;
    const since = (connection.last_sync && !explicitWindow)
      ? new Date(new Date(connection.last_sync).getTime() - 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);

    const url =
      `${METASTATS_URL}/users/current/accounts/${connection.metaapi_account_id}` +
      `/historical-trades/${encodeURIComponent(metaStatsTime(since))}` +
      `/${encodeURIComponent(metaStatsTime(now))}?updateHistory=true&limit=1000`;

    const res = await fetch(url, { headers: { "auth-token": token } });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ error: `Couldn't read your trade history. ${detail}`.trim() }, 400);
    }

    if (debug) {
      const text = await res.text().catch(() => "");

      /*
        Diagnostic for one specific question: is the profit MetaStats gives
        us gross, or already net of commission and swap? Adding them to a
        figure that already includes them would make P&L less accurate, not
        more, so this compares the two for the same positions before any
        column is written.
      */
      /*
        Summarised rather than sampled. A raw prefix answers "what does the
        first order look like", which is the wrong question - the one that
        matters is whether any order in the account carries a stop loss.
      */
      const clientBase =
        `https://mt-client-api-v1.london.agiliumtrade.ai` +
        `/users/current/accounts/${connection.metaapi_account_id}`;
      const range =
        `/time/${encodeURIComponent(since.toISOString())}` +
        `/${encodeURIComponent(now.toISOString())}`;

      let dealsSample: unknown = null;
      if (body?.probeDeals === true) {
        const r = await fetch(`${clientBase}/history-deals${range}`, {
          headers: { "auth-token": token },
        });
        const d = await r.json().catch(() => []) as Record<string, unknown>[];
        const list = Array.isArray(d) ? d : [];
        dealsSample = {
          status: r.status,
          count: list.length,
          withCommission: list.filter((x) => Number(x.commission ?? 0) !== 0).length,
          withSwap: list.filter((x) => Number(x.swap ?? 0) !== 0).length,
          totalCommission: list.reduce((n, x) => n + Number(x.commission ?? 0), 0),
          totalSwap: list.reduce((n, x) => n + Number(x.swap ?? 0), 0),
          reasons: [...new Set(list.map((x) => String(x.reason ?? "")))],
        };
      }

      let ordersSample: unknown = null;
      if (body?.probeOrders === true) {
        const r = await fetch(`${clientBase}/history-orders${range}`, {
          headers: { "auth-token": token },
        });
        const d = await r.json().catch(() => []) as Record<string, unknown>[];
        const list = Array.isArray(d) ? d : [];
        const withSl = list.filter((x) => x.stopLoss != null);
        ordersSample = {
          status: r.status,
          count: list.length,
          withStopLoss: withSl.length,
          withTakeProfit: list.filter((x) => x.takeProfit != null).length,
          reasons: [...new Set(list.map((x) => String(x.reason ?? "")))],
          types: [...new Set(list.map((x) => String(x.type ?? "")))],
          exampleWithStopLoss: withSl[0] ?? null,
          exampleAny: list[0] ?? null,
        };
      }

      return json({
        debug: true,
        requestedUrl: url,
        windowFrom: metaStatsTime(since),
        windowTo: metaStatsTime(now),
        status: res.status,
        rawFirst2000: text.slice(0, 2000),
        dealsSample,
        ordersSample,
      });
    }

    const payload = await res.json().catch(() => null) as
      | { trades?: MetaStatsTrade[] }
      | MetaStatsTrade[]
      | null;
    const raw: MetaStatsTrade[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.trades)
      ? payload!.trades!
      : [];


    /*
      MetaTrader's deal history, for what MetaStats leaves out: how each
      position ended, and what it cost in commission and swap.

      Free - MetaApi charges for account hosting, not per call - and the
      account is already deployed while a sync runs, so this is one more
      request inside a window being paid for regardless.

      A failure here degrades rather than breaks: the trades still import,
      just without the close reason and costs, which is much better than
      losing the sync over an enrichment.
    */
    let dealSummary = new Map();
    try {
      const dealsRes = await fetch(
        `https://mt-client-api-v1.london.agiliumtrade.ai` +
          `/users/current/accounts/${connection.metaapi_account_id}/history-deals` +
          `/time/${encodeURIComponent(since.toISOString())}` +
          `/${encodeURIComponent(now.toISOString())}`,
        { headers: { "auth-token": token } },
      );
      if (dealsRes.ok) {
        const deals = await dealsRes.json().catch(() => []);
        if (Array.isArray(deals)) dealSummary = summariseDeals(deals);
      }
    } catch {
      /* Enrichment only. The trades below import either way. */
    }

    const rows = [];
    let stillOpen = 0;
    let notTrades = 0;
    /*
      Deposits and withdrawals are what the account actually started with
      and what has been paid in or out since. Summed, they are a far better
      "starting balance" than a number typed into a form - the user who
      prompted this typed 200000.1 for an account that opened at exactly
      200000, and that dime would have skewed their return forever.
    */
    let netDeposits = 0;
    let sawDeposit = false;

    for (const t of raw) {
      /*
        Deposits, withdrawals and credit adjustments come back in the same
        list as trades, typed DEAL_TYPE_BALANCE and carrying no symbol. The
        opening deposit on a funded account is the dangerous one: it has a
        profit of the full account size, so letting one through would show
        as a $200,000 winning trade and wreck every metric on the page.
      */
      if (isBalanceMovement(t)) {
        notTrades++;
        if (Number.isFinite(t.profit)) {
          netDeposits += Number(t.profit);
          sawDeposit = true;
        }
        continue;
      }

      /*
        Null for a position still open - no close time, no final profit -
        which belongs on a live view rather than a record of what happened.
      */
      const row = toTradeRow(t, user.id, connection.id, dealSummary);
      if (!row) {
        stillOpen++;
        continue;
      }
      rows.push(row);
    }

    let imported = 0;
    if (rows.length) {
      /*
        onConflict on the same pair the unique index covers, so a re-sync
        updates the row it already wrote instead of failing or duplicating.
      */
      const { error: upsertError, count } = await supabase
        .from("trades")
        .upsert(rows, { onConflict: "user_id,external_id", count: "exact" });

      if (upsertError) {
        return json({ error: `Couldn't save your trades. ${upsertError.message}` }, 400);
      }
      imported = count ?? rows.length;
    }

    /*
      Balances come from the broker rather than from whatever was typed
      when the account was added. Starting balance is the net of deposits
      and withdrawals; current balance is that plus realised P&L.

      Only written when a deposit was actually seen. An account whose
      opening deposit predates the sync window would otherwise have its
      starting balance silently rewritten to zero.
    */
    const balanceUpdate: Record<string, unknown> = { last_sync: now.toISOString() };

    const startingBalance = sawDeposit
      ? netDeposits
      : Number(connection.starting_balance ?? 0);

    /*
      Realised P&L is summed from every trade we hold for this account, not
      just the ones this run happened to fetch. An incremental sync only
      looks at the last day or so, and adding that day's profit to the
      opening balance would report a wildly wrong number.
    */
    const { data: allTrades } = await supabase
      .from("trades")
      .select("pnl")
      .eq("broker_id", connectionId)
      .not("external_id", "is", null);

    const realised = (allTrades ?? []).reduce(
      (sum: number, t: { pnl: number | null }) => sum + Number(t.pnl ?? 0),
      0,
    );

    if (sawDeposit) balanceUpdate.starting_balance = netDeposits;
    if (sawDeposit || Number(connection.starting_balance ?? 0) > 0) {
      balanceUpdate.current_balance = startingBalance + realised;
      balanceUpdate.last_balance_update = now.toISOString();
    }

    await supabase
      .from("user_broker_connections")
      .update(balanceUpdate)
      .eq("id", connectionId);

    return json({
      synced: true,
      found: raw.length,
      imported,
      skippedStillOpen: stillOpen,
      skippedNotTrades: notTrades,
      startingBalance: sawDeposit ? netDeposits : null,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
