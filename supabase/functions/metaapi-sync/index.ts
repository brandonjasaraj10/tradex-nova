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

interface MetaStatsTrade {
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
}

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
      .select("id, user_id, metaapi_account_id, last_sync")
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
      return json({
        debug: true,
        requestedUrl: url,
        windowFrom: metaStatsTime(since),
        windowTo: metaStatsTime(now),
        status: res.status,
        rawFirst2000: text.slice(0, 2000),
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

    const rows = [];
    let stillOpen = 0;
    let notTrades = 0;

    for (const t of raw) {
      const externalId = t._id ?? t.positionId;

      /*
        Deposits, withdrawals and credit adjustments come back in the same
        list as trades, typed DEAL_TYPE_BALANCE and carrying no symbol. The
        opening deposit on a funded account is the dangerous one: it has a
        profit of the full account size, so letting one through would show
        as a $200,000 winning trade and wreck every metric on the page.
      */
      const dealType = String(t.type ?? "").toUpperCase();
      if (!t.symbol || dealType.includes("BALANCE") || dealType.includes("CREDIT")) {
        notTrades++;
        continue;
      }

      /*
        A trade still open has no close time and no final profit. Those
        belong on a live-positions view, not in a journal of what happened.
      */
      if (!externalId || !t.openTime || !t.closeTime) {
        stillOpen++;
        continue;
      }

      const direction = String(t.type ?? "").toUpperCase().includes("SELL")
        ? "SHORT"
        : "LONG";

      rows.push({
        user_id: user.id,
        broker_id: connection.id,
        external_id: String(externalId),
        symbol: t.symbol,
        direction,
        quantity: Number(t.volume ?? 0),
        entry_price: Number(t.openPrice ?? 0),
        exit_price: Number(t.closePrice ?? 0),
        entry_date: new Date(t.openTime).toISOString(),
        exit_date: new Date(t.closeTime).toISOString(),
        pnl: Number(t.profit ?? 0),
      });
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

    await supabase
      .from("user_broker_connections")
      .update({ last_sync: now.toISOString() })
      .eq("id", connectionId);

    return json({
      synced: true,
      found: raw.length,
      imported,
      skippedStillOpen: stillOpen,
      skippedNotTrades: notTrades,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
