/*
  What the trader is in right now.

  Everything else in this feature is history: trades that have closed and
  can be judged. This is the one thing the journal cannot reconstruct
  afterwards, and it exists for two reasons.

  The obvious one is the view - a trade held over three weeks appears
  nowhere until it closes, because a trade belongs to the day it closed.
  Without this there is no answer to "what am I in?".

  The less obvious one matters more. MetaTrader records a stop loss on the
  POSITION, not on the order that opened it, so once a position is gone the
  level it carried is gone too. History can only say a trade ended AT a
  stop, never where the stop was on a trade that ended some other way. Read
  live, every position states its stopLoss and takeProfit plainly - which is
  the only way to know the levels on trades that never reached them, and so
  the only way to compare planned reward-to-risk against achieved.

  Read-only, and never written to from here: the account is connected with
  an investor password, which cannot modify a position even if we asked.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLIENT_URL = "https://mt-client-api-v1.london.agiliumtrade.ai";

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

const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

interface MetaApiPosition {
  id?: string;
  symbol?: string;
  type?: string;
  volume?: number;
  openPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  unrealizedProfit?: number;
  swap?: number;
  commission?: number;
  time?: string;
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

    const { data: connection, error: readError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id, metaapi_account_id")
      .eq("id", connectionId)
      .maybeSingle();

    if (readError || !connection || connection.user_id !== user.id) {
      return json({ error: "Account not found." }, 404);
    }
    if (!connection.metaapi_account_id) {
      return json({ error: "That account isn't set up for syncing." }, 400);
    }

    const res = await fetch(
      `${CLIENT_URL}/users/current/accounts/${connection.metaapi_account_id}/positions`,
      { headers: { "auth-token": token } },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      /*
        Written down, because until now it was not.

        MetaApi says why it refused, and that reason reached the browser in
        a field nothing rendered - so on screen it was always the same
        sentence and the actual cause was unrecoverable after the fact. That
        is the identical blind spot that hid a 403 on MetaStats for an hour
        while a connected account silently synced nothing.

        Server-side on purpose: it belongs in the logs where it can be read
        later without the trader having had dev tools open at the moment,
        and the person on screen still gets plain English.
      */
      console.error(
        `metaapi-positions: MetaApi ${res.status} for connection ${connectionId}`,
        detail.slice(0, 300),
      );
      /*
        A stopped account cannot answer this - live positions need a running
        terminal. Said plainly rather than as a failure, because it is a
        state the trader can do something about.
      */
      return json({
        error: "Couldn't read your open positions right now.",
        detail: detail.slice(0, 300),
        accountNotRunning: res.status === 404 || res.status === 400,
      }, 400);
    }

    const raw = await res.json().catch(() => []) as MetaApiPosition[];
    const list = Array.isArray(raw) ? raw : [];

    const positions = list.map((p) => {
      const direction = String(p.type ?? "").toUpperCase().includes("SELL")
        ? "SHORT"
        : "LONG";
      const openPrice = numberOrNull(p.openPrice);
      const stopLoss = numberOrNull(p.stopLoss);
      const takeProfit = numberOrNull(p.takeProfit);

      return {
        position_id: p.id ?? null,
        symbol: p.symbol ?? "",
        direction,
        volume: numberOrNull(p.volume),
        open_price: openPrice,
        current_price: numberOrNull(p.currentPrice),
        stop_loss: stopLoss,
        take_profit: takeProfit,
        /*
          Distance to each level, so the trader does not have to do the
          arithmetic to see whether a target is twice the stop or half of
          it. Null when a level is not set, which is itself worth seeing -
          a position running without a stop is the thing most worth
          noticing on this screen.
        */
        risk_distance: openPrice !== null && stopLoss !== null
          ? Math.abs(openPrice - stopLoss) : null,
        reward_distance: openPrice !== null && takeProfit !== null
          ? Math.abs(takeProfit - openPrice) : null,
        unrealised_pnl: numberOrNull(p.unrealizedProfit) ?? numberOrNull(p.profit),
        swap: numberOrNull(p.swap),
        commission: numberOrNull(p.commission),
        /* Already a UTC instant here, unlike MetaStats' broker-time strings. */
        opened_at: p.time ?? null,
      };
    });

    return json({
      positions,
      count: positions.length,
      without_a_stop: positions.filter((p) => p.stop_loss === null).length,
      total_unrealised: positions.reduce(
        (n, p) => n + (p.unrealised_pnl ?? 0), 0),
      as_of: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
