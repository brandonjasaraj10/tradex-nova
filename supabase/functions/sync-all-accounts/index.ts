/*
  Scheduled sync. Runs on a timer with nobody logged in, walks every
  connected account, and pulls in whatever has closed since last time.

  This is the only function in the broker-sync set that uses the service
  role key, because there is no user making the request - a cron job has no
  JWT to act on behalf of. That makes it the one place where a mistake
  could touch another user's data, so every write is explicitly scoped to
  the user_id stored on the connection being processed, never inferred.

  Guarded by a shared secret rather than left open: the endpoint has to be
  callable by pg_cron, which cannot present a user token.

  Accounts are processed one at a time and a failure on one is recorded and
  stepped over. One expired password shouldn't stop everyone else's trades
  from arriving.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  type MetaStatsTrade,
  isBalanceMovement,
  summariseDeals,
  toTradeRow,
  FULL_HISTORY_START,
  fetchHistoricalTrades,
} from "../_shared/metaStatsTrade.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function syncOne(
  admin: ReturnType<typeof createClient>,
  token: string,
  connection: {
    id: string;
    user_id: string;
    metaapi_account_id: string;
    last_sync: string | null;
    starting_balance: number | null;
  },
): Promise<
  { id: string; imported?: number; error?: string; truncated?: boolean }
> {
  const now = new Date();
  /*
    A first sync takes the whole account; every sync after it takes the
    day around the last one. The deep window is the expensive case and it
    happens once, which is why it is worth doing properly rather than
    cutting it to a year and hoping nobody traded before that.
  */
  const since = connection.last_sync
    ? new Date(new Date(connection.last_sync).getTime() - 24 * 60 * 60 * 1000)
    : FULL_HISTORY_START;

  let raw: MetaStatsTrade[];
  let truncated = false;
  try {
    const fetched = await fetchHistoricalTrades(
      token,
      connection.metaapi_account_id,
      since,
      now,
    );
    raw = fetched.trades;
    truncated = fetched.truncated;
  } catch (err) {
    return {
      id: connection.id,
      error: err instanceof Error ? err.message : "MetaApi request failed",
    };
  }


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
  let netDeposits = 0;
  let sawDeposit = false;

  for (const t of raw) {
    if (isBalanceMovement(t)) {
      if (Number.isFinite(t.profit)) {
        netDeposits += Number(t.profit);
        sawDeposit = true;
      }
      continue;
    }

    /* Owner comes from the connection, never from anything in the payload. */
    const row = toTradeRow(t, connection.user_id, connection.id, dealSummary);
    if (row) rows.push(row);
  }

  if (rows.length) {
    const { error } = await admin
      .from("trades")
      .upsert(rows, { onConflict: "user_id,external_id" });
    if (error) return { id: connection.id, error: error.message };
  }

  const update: Record<string, unknown> = { last_sync: now.toISOString() };
  const starting = sawDeposit
    ? netDeposits
    : Number(connection.starting_balance ?? 0);

  const { data: allTrades } = await admin
    .from("trades")
    .select("pnl")
    .eq("broker_id", connection.id)
    .not("external_id", "is", null);

  const realised = (allTrades ?? []).reduce(
    (sum: number, t: { pnl: number | null }) => sum + Number(t.pnl ?? 0),
    0,
  );

  if (sawDeposit) update.starting_balance = netDeposits;
  if (sawDeposit || Number(connection.starting_balance ?? 0) > 0) {
    update.current_balance = starting + realised;
    update.last_balance_update = now.toISOString();
  }

  await admin.from("broker_connections").update(update).eq("id", connection.id);

  /*
    truncated means the 50-page ceiling was hit and this account has more
    history than was fetched. Reported rather than hidden: a partial
    import that reads as a complete one is the thing this is here to
    prevent.
  */
  return truncated
    ? { id: connection.id, imported: rows.length, truncated: true }
    : { id: connection.id, imported: rows.length };
}

Deno.serve(async (req: Request) => {
  /* Same secret and header the other scheduled jobs already use. */
  const secret = Deno.env.get("CRON_SECRET");
  const token = Deno.env.get("METAAPI_TOKEN");

  if (!secret || !token) {
    return json({ error: "Not configured" }, 503);
  }
  if (req.headers.get("X-Cron-Secret") !== secret) {
    return json({ error: "Forbidden" }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: connections, error } = await admin
    .from("broker_connections")
    .select("id, user_id, metaapi_account_id, last_sync, starting_balance")
    .not("metaapi_account_id", "is", null)
    .eq("is_auto_sync_enabled", true);

  if (error) return json({ error: error.message }, 500);

  /*
    Only sync for people who are actually paying.

    A cancelled or failed-payment subscriber keeps their connection - it is
    stopped at MetaApi rather than deleted, so it can start again untouched
    when they come back. But "kept" is not "running": syncing them would
    mean calling a third party on behalf of somebody with no access to the
    result, every cycle, for as long as they stay gone.

    Read here rather than trusted from is_auto_sync_enabled, because that
    flag is the trader's own on/off switch and should not be quietly
    rewritten by billing.
  */
  const userIds = [...new Set((connections ?? []).map((c: { user_id: string }) => c.user_id))];
  const { data: subs } = await admin
    .from("subscriptions")
    .select("user_id, status, current_period_end")
    .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const now = Date.now();
  const paying = new Set(
    (subs ?? [])
      .filter((s: { status: string; current_period_end: string | null }) =>
        s.status === "active" || s.status === "trialing" ||
        (s.status === "canceled" && s.current_period_end
          && new Date(s.current_period_end).getTime() > now))
      .map((s: { user_id: string }) => s.user_id),
  );

  const results = [];
  for (const connection of (connections ?? []).filter(
    (c: { user_id: string }) => paying.has(c.user_id),
  )) {
    try {
      results.push(await syncOne(admin, token, connection as never));
    } catch (err) {
      /*
        One broken account must not stop the rest. A rejected password or a
        broker outage is a per-account problem, not a reason for everybody
        else's trades to stop arriving.
      */
      results.push({
        id: (connection as { id: string }).id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return json({
    accounts: results.length,
    imported: results.reduce((n, r) => n + (r.imported ?? 0), 0),
    failed: results.filter((r) => r.error).length,
    truncated: results.filter((r) => r.truncated).length,
    results,
  });
});
