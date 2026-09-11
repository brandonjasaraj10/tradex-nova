/*
  Connect a trading account to MetaApi so its trades can be synced.

  The security shape of this function is the whole point of it, so it's
  worth stating plainly:

    - The investor password arrives here over HTTPS, is handed to MetaApi,
      and is then gone. It is never written to our database, never logged,
      and never returned in a response. All we keep is the account id
      MetaApi gives back, which is worthless to anyone without our own API
      token.
    - The caller may only connect a broker_connections row they own. The
      row is read with the caller's own token so RLS enforces that, and the
      ownership is checked again explicitly rather than inferred from the
      read succeeding.

  Cost matters here in a way it doesn't in most functions. MetaApi charges
  $2.10 the first time a given account is added in a month, and $0.105 for
  each "excessive" failed attempt - retrying after a permanent error. So:

    - If the row already has a metaapi_account_id we stop immediately
      rather than creating a second paid account.
    - 400/401/403/404 are permanent. We surface them and never retry.
    - Only 202 (accepted, still processing) is retried, honouring the
      Retry-After header MetaApi sends.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROVISIONING_URL =
  // Global endpoint, not regional - see the note in mt-servers/index.ts.
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
  MetaApi's own words for why a connection failed are usually better than
  anything we'd invent ("Invalid account credentials", "Server not found").
  Pull the useful sentence out and leave the rest.
*/
function readMetaApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["message", "error", "details"]) {
      const v = p[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return fallback;
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
    const login = String(body?.login ?? "").trim();
    const server = String(body?.server ?? "").trim();
    const password = String(body?.password ?? "");
    const platform = body?.platform === "mt4" ? "mt4" : "mt5";

    if (!connectionId || !login || !server || !password) {
      return json({ error: "Account number, server and password are all required." }, 400);
    }
    if (!/^\d+$/.test(login)) {
      return json({ error: "The account number should be digits only." }, 400);
    }

    /*
      Read through the caller's own token, so RLS decides what they can
      see, then check ownership explicitly anyway. Belt and braces: this is
      the exact shape of bug that made an earlier function leak another
      user's trades.
    */
    const { data: connection, error: readError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id, account_name, metaapi_account_id")
      .eq("id", connectionId)
      .maybeSingle();

    if (readError || !connection) {
      return json({ error: "Account not found." }, 404);
    }
    if (connection.user_id !== user.id) {
      return json({ error: "Account not found." }, 404);
    }
    if (connection.metaapi_account_id) {
      return json({
        error: "This account is already connected.",
        alreadyConnected: true,
      }, 409);
    }

    /*
      Checked before anything is created, because creating is what costs
      money: $2.10 the first time an account is added in a month, and about
      $9 a month for as long as it runs. A cap enforced after the fact would
      be a cap that had already been paid for.

      The limit comes from synced_account_limit() rather than a number
      written here, so the screen that says "1 of 2 used" and the rule that
      refuses the third are reading the same thing.
    */
    const { data: limitData, error: limitError } = await supabase.rpc('synced_account_limit');
    const limit = typeof limitData === 'number' ? limitData : 0;

    if (limitError) {
      return json({ error: "Couldn't check your plan's account limit." }, 500);
    }

    const { count: connectedCount, error: countError } = await supabase
      .from('user_broker_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('metaapi_account_id', 'is', null);

    if (countError) {
      return json({ error: "Couldn't check how many accounts you have connected." }, 500);
    }

    if ((connectedCount ?? 0) >= limit) {
      return json({
        error: limit === 0
          ? 'Automatic syncing needs an active subscription.'
          : `Your plan covers ${limit} synced ${limit === 1 ? 'account' : 'accounts'}. Disconnect one to connect another.`,
        limitReached: true,
        limit,
        connected: connectedCount ?? 0,
      }, 403);
    }

    /*
      type and reliability are left at MetaApi's defaults (cloud-g2 /
      high) on purpose - g2 is roughly a third the price of g1, and
      regular reliability isn't offered on g2 anyway.
    */
    const createBody = {
      name: `TradeX ${connection.account_name ?? login}`.slice(0, 64),
      login,
      password,
      server,
      platform,
      magic: 0,
      region: "london",
    };

    let created: Response | null = null;
    let payload: unknown = null;

    // Only a 202 is worth trying again; everything else is decided.
    for (let attempt = 0; attempt < 4; attempt++) {
      created = await fetch(`${PROVISIONING_URL}/users/current/accounts`, {
        method: "POST",
        headers: { "auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      payload = await created.json().catch(() => null);

      if (created.status !== 202) break;

      const retryAfter = Number(created.headers.get("Retry-After") ?? "5");
      await sleep(Math.min(Math.max(retryAfter, 1), 15) * 1000);
    }

    if (!created || !created.ok) {
      const status = created?.status ?? 500;
      /*
        Deliberately not retried. A wrong password or an unknown server
        will never succeed on the second attempt, and MetaApi bills us
        $0.105 for each attempt that ignores a permanent error.
      */
      const message = readMetaApiError(
        payload,
        status === 400
          ? "Those details were rejected. Check the account number, server and investor password."
          : "Couldn't connect that account.",
      );
      return json({ error: message, permanent: status < 500 }, 400);
    }

    const accountId = (payload as { id?: string } | null)?.id;
    if (!accountId) {
      return json({ error: "MetaApi didn't return an account id." }, 502);
    }

    /*
      Save the id before verifying the connection. If we crashed between
      creating and saving, we'd have an account we're paying for and no
      record of it - an invisible charge with nothing pointing at it.
    */
    const { error: saveError } = await supabase
      .from("user_broker_connections")
      .update({
        metaapi_account_id: accountId,
        mt_login: login,
        metaapi_server: server,
        platform,
        is_auto_sync_enabled: true,
      })
      .eq("id", connectionId);

    if (saveError) {
      return json({
        error: "Connected, but we couldn't save it. Please contact support.",
        accountId,
      }, 500);
    }

    /*
      Report where it got to rather than blocking until it's live. A
      MetaTrader account can take a couple of minutes to come up, which is
      longer than this function is allowed to run.
    */
    let state: string | null = null;
    let connectionStatus: string | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      await sleep(3000);
      const check = await fetch(
        `${PROVISIONING_URL}/users/current/accounts/${accountId}`,
        { headers: { "auth-token": token } },
      );
      if (!check.ok) continue;
      const account = await check.json().catch(() => null) as
        | { state?: string; connectionStatus?: string }
        | null;
      state = account?.state ?? state;
      connectionStatus = account?.connectionStatus ?? connectionStatus;
      if (connectionStatus === "CONNECTED") break;
    }

    return json({
      accountId,
      state,
      connectionStatus,
      connected: connectionStatus === "CONNECTED",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
