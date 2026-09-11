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
  toTradeRow,
} from "../_shared/metaStatsTrade.ts";

const METASTATS_URL = "https://metastats-api-v1.london.agiliumtrade.ai";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const metaStatsTime = (d: Date) =>
  d.toISOString().replace("T", " ").replace("Z", "");

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
): Promise<{ id: string; imported?: number; error?: string }> {
  const now = new Date();
  const since = connection.last_sync
    ? new Date(new Date(connection.last_sync).getTime() - 24 * 60 * 60 * 1000)
    : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const url =
    `${METASTATS_URL}/users/current/accounts/${connection.metaapi_account_id}` +
    `/historical-trades/${encodeURIComponent(metaStatsTime(since))}` +
    `/${encodeURIComponent(metaStatsTime(now))}?updateHistory=true&limit=1000`;

  const res = await fetch(url, { headers: { "auth-token": token } });
  if (!res.ok) {
    return { id: connection.id, error: `MetaApi returned ${res.status}` };
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
    const row = toTradeRow(t, connection.user_id, connection.id);
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

  return { id: connection.id, imported: rows.length };
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
    results,
  });
});
