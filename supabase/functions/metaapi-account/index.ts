/*
  Look after an account that's already connected to MetaApi: check where it
  is, start it, or take it away entirely.

  Disconnecting matters more than it looks. MetaApi bills for as long as an
  account exists in their cloud, so an account we forget to remove - after
  a user deletes it, downgrades, or cancels - is a charge that carries on
  with nobody using it. "Delete" here means actually gone from MetaApi, not
  just hidden in our own table.

  Every action checks the caller owns the connection, and reads the row
  through the caller's own token so RLS applies as well.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { releaseMetaApiAccount } from "../_shared/metaApiAccount.ts";

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
    const action = String(body?.action ?? "status");

    if (!connectionId) {
      return json({ error: "Which account?" }, 400);
    }
    if (!["status", "deploy", "undeploy", "disconnect", "enable-metastats"].includes(action)) {
      return json({ error: "Unknown action" }, 400);
    }

    const { data: connection, error: readError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id, metaapi_account_id")
      .eq("id", connectionId)
      .maybeSingle();

    if (readError || !connection || connection.user_id !== user.id) {
      return json({ error: "Account not found." }, 404);
    }

    const accountId = connection.metaapi_account_id;
    if (!accountId) {
      return json({ error: "That account isn't set up for syncing." }, 400);
    }

    const base = `${PROVISIONING_URL}/users/current/accounts/${accountId}`;
    const auth = { "auth-token": token };

    if (action === "enable-metastats") {
      /*
        MetaStats is billed separately (~$1.15 per account per month) and is
        off by default, so this is a deliberate, explicit switch rather than
        something provisioning does quietly. It's what gives us drawdown and
        the other computed metrics, and it's also what serves trade history
        already paired into round turns.

        Only metastatsApiEnabled is sent. The same endpoint can turn on
        CopyFactory, risk management, a dedicated IP and increased
        reliability, every one of which costs more - so they are left
        untouched rather than defaulted.
      */
      const res = await fetch(`${base}/enable-account-features`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ metastatsApiEnabled: true }),
      });
      if (!res.ok && res.status !== 204) {
        const detail = await res.text().catch(() => "");
        return json({ error: `Couldn't enable metrics. ${detail}`.trim() }, 400);
      }
      return json({ metastatsEnabled: true });
    }

    if (action === "undeploy") {
      /*
        Stops the account without removing it. Takes an account from about
        $9 a month to about $0.77 while keeping it registered, so it can be
        started again without the investor password - which we never store.
        This is what a failed payment does, as opposed to a cancellation.
      */
      const res = await fetch(`${base}/undeploy`, { method: "POST", headers: auth });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return json({ error: `Couldn't stop the account. ${detail}`.trim() }, 400);
      }
      return json({ undeployed: true });
    }

    if (action === "deploy") {
      const res = await fetch(`${base}/deploy`, { method: "POST", headers: auth });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return json({ error: `Couldn't start the account. ${detail}`.trim() }, 400);
      }
    }

    if (action === "disconnect") {
      /* One implementation of undeploy-then-delete, shared with the
         remove-account route in broker-api. Two copies of this would drift,
         and the copy that drifts is the one that stops stopping the bill. */
      const release = await releaseMetaApiAccount(accountId, token);
      if (!release.released) {
        return json({
          error: `Couldn't remove the account from MetaApi. ${release.detail ?? ""}`.trim(),
          stillBilling: true,
        }, 400);
      }

      /*
        Only clear our own record once MetaApi has confirmed it's gone. If
        we cleared first and the delete failed, we'd lose the only pointer
        to an account still costing money.
      */
      await supabase
        .from("user_broker_connections")
        .update({
          metaapi_account_id: null,
          is_auto_sync_enabled: false,
        })
        .eq("id", connectionId);

      return json({ disconnected: true });
    }

    const res = await fetch(base, { headers: auth });
    if (!res.ok) {
      return json({ error: `MetaApi returned ${res.status}` }, 400);
    }
    const account = await res.json().catch(() => null) as Record<string, unknown> | null;

    return json({
      accountId,
      state: account?.state ?? null,
      connectionStatus: account?.connectionStatus ?? null,
      reliability: account?.reliability ?? null,
      type: account?.type ?? null,
      region: account?.region ?? null,
      server: account?.server ?? null,
      login: account?.login ?? null,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
