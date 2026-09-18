import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";
import { parkMetaApiAccount, releaseMetaApiAccount, wakeMetaApiAccount } from "../_shared/metaApiAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const pathname = url.pathname.replace("/broker-api", "");

    if (pathname === "/list" && req.method === "GET") {
      const { data: brokers, error } = await supabase
        .from("brokers")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ brokers }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pathname === "/connections" && req.method === "GET") {
      const { data: connections, error } = await supabase
        .from("user_broker_connections")
        .select(`
          id,
          account_name,
          account_type,
          status,
          last_sync,
          created_at,
          metaapi_account_id,
          is_auto_sync_enabled,
          starting_balance,
          current_balance,
          currency,
          ownership_type,
          last_balance_update,
          broker_id,
          broker_type,
          sync_paused_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // broker_id on user_broker_connections has no real foreign key to
      // brokers (it's plain text, not a UUID FK), and trades_count isn't
      // a stored column at all - both are resolved here instead of via
      // a PostgREST embed that could never work.
      const { data: brokersData } = await supabase.from("brokers").select("id, name, display_name");
      const brokersById = new Map((brokersData || []).map((b: any) => [b.id, b]));

      const enrichedConnections = await Promise.all(
        (connections || []).map(async (conn: any) => {
          const { count } = await supabase
            .from("trades")
            .select("*", { count: "exact", head: true })
            .eq("broker_id", conn.id);

          const broker = conn.broker_id ? brokersById.get(conn.broker_id) : null;

          return {
            ...conn,
            last_synced_at: conn.last_sync,
            trades_count: count || 0,
            brokers: broker ? { name: broker.display_name || broker.name } : null,
          };
        })
      );

      return new Response(JSON.stringify({ connections: enrichedConnections }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /*
      Turning syncing off. The common case, and deliberately not a delete.

      The account, its trades and its whole history stay exactly where they
      are and stay visible - what stops is automatic syncing, and the
      MetaApi account is parked so it costs $0.73 a month instead of $8.64.
      The sync slot goes back to the plan's allowance, which is the thing
      the customer is actually paying for.

      No trades guard here, because nothing is being destroyed. That guard
      exists to stop trade history pointing at an account that no longer
      exists, and after this the account still exists.
    */
    if (pathname === "/disconnect" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connectionRow, error: pointerError } = await supabase
        .from("user_broker_connections")
        .select("metaapi_account_id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (pointerError) {
        return new Response(JSON.stringify({ error: clientSafeMessage(pointerError) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metaapiAccountId = connectionRow?.metaapi_account_id ?? null;

      /*
        A manual or CSV account has no syncing to turn off, so pausing it
        would be a button that visibly does nothing. Removing one means
        removing it, and this route still does that - trades guard and all.

        This branch also protects the live site while the frontend catches
        up. Deployed functions go live immediately; the bundle in front of
        users still calls /disconnect expecting a delete, and every account
        it can reach today is a manual one because syncing is switched off.
        So for them nothing changes at all.
      */
      if (!metaapiAccountId) {
        const { count: tradeCount, error: countError } = await supabase
          .from("trades")
          .select("id", { count: "exact", head: true })
          .eq("broker_id", connection_id)
          .eq("user_id", user.id);

        if (countError) {
          return new Response(JSON.stringify({ error: clientSafeMessage(countError) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if ((tradeCount ?? 0) > 0) {
          return new Response(
            JSON.stringify({
              error: `This account still has ${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}. Delete or move them before removing the account, so your trade history isn't left pointing at an account that no longer exists.`,
              hasTrades: true,
              tradeCount: tradeCount ?? 0,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await supabase
          .from("user_broker_connections")
          .delete()
          .eq("id", connection_id)
          .eq("user_id", user.id);

        if (deleteError) {
          return new Response(JSON.stringify({ error: clientSafeMessage(deleteError) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ success: true, deleted: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      {
        const metaapiToken = Deno.env.get("METAAPI_TOKEN");
        if (!metaapiToken) {
          return new Response(
            JSON.stringify({
              error: "Account syncing isn't configured, so this can't be turned off safely. Please contact support.",
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        /*
          Park before recording it. If MetaApi will not stop the account,
          saying we paused it would free the slot while the meter kept
          running at full price - the one outcome worth refusing over.
        */
        const parked = await parkMetaApiAccount(metaapiAccountId, metaapiToken);
        if (!parked.released) {
          console.error(
            "MetaApi undeploy failed, leaving sync on:",
            connection_id,
            metaapiAccountId,
            parked.detail,
          );
          return new Response(
            JSON.stringify({
              error: "We couldn't stop this account with our sync provider, so syncing is still on. Please try again in a moment.",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { error } = await supabase
        .from("broker_connections")
        .update({ sync_paused_at: new Date().toISOString(), is_auto_sync_enabled: false })
        .eq("id", connection_id)
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      /* Keeping a parked account is cheap, not free - see the helper. */
      try {
        await releaseOldestParkedOverLimit(supabase as never, user.id);
      } catch (e) {
        console.error("Parked-account trim failed (continuing):", user.id, e);
      }

      return new Response(
        JSON.stringify({ success: true, paused: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
      Turning syncing back on.

      The parked MetaApi account still holds this account's credentials, so
      this is a deploy rather than a $2.10 purchase - which is the entire
      reason removal parks instead of deletes.

      The slot is checked here and not only in the UI, because the UI is a
      suggestion and this is the thing that actually costs money.
    */
    if (pathname === "/reconnect" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connectionRow, error: readError } = await supabase
        .from("user_broker_connections")
        .select("metaapi_account_id, account_name")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (readError || !connectionRow) {
        return new Response(JSON.stringify({ error: "Account not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      /*
        The _for variants, because this function holds the service-role key
        and auth.uid() is null under it. The auth.uid() versions come back 0
        here, which reads as "no subscription" and would refuse a resume to
        somebody who is paying.
      */
      const { data: limitData } = await supabase.rpc("synced_account_limit_for", { p_user_id: user.id });
      const { data: inUseData } = await supabase.rpc("synced_accounts_in_use", { p_user_id: user.id });
      const limit = typeof limitData === "number" ? limitData : 0;
      const inUse = typeof inUseData === "number" ? inUseData : 0;

      if (inUse >= limit) {
        return new Response(
          JSON.stringify({
            error: limit === 0
              ? "Automatic syncing needs an active subscription."
              : `All ${limit} of your sync slots are in use. Turn syncing off on another account, or add a slot.`,
            slotsFull: true,
            limit,
            inUse,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaapiAccountId = connectionRow.metaapi_account_id;
      if (metaapiAccountId) {
        const metaapiToken = Deno.env.get("METAAPI_TOKEN");
        if (!metaapiToken) {
          return new Response(
            JSON.stringify({ error: "Account syncing isn't configured yet." }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const woken = await wakeMetaApiAccount(metaapiAccountId, metaapiToken);
        if (!woken.released) {
          /*
            The parked account would not start. Most often its credentials
            went stale while it sat idle, and the fix is to connect it again
            with the current investor password - which the connect flow will
            reuse this same account for, so it still costs nothing.
          */
          console.error("Parked account would not deploy:", metaapiAccountId, woken.detail);
          return new Response(
            JSON.stringify({
              error: "That account wouldn't start again. Connect it once more with your investor password and we'll reuse the same connection.",
              needsCredentials: true,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { error } = await supabase
        .from("broker_connections")
        .update({ sync_paused_at: null, is_auto_sync_enabled: true })
        .eq("id", connection_id)
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, reconnected: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
      Deleting the account for real. Rare, and the only destructive route.

      This is where the trades guard belongs, and it is now genuinely
      load-bearing: nothing else stands between a user and trade history
      pointing at an account that no longer exists. Journal entries need no
      such check - their reference is ON DELETE SET NULL, so they survive
      and reappear under All Accounts.
    */
    if (pathname === "/delete" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count: tradeCount, error: countError } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("broker_id", connection_id)
        .eq("user_id", user.id);

      if (countError) {
        return new Response(JSON.stringify({ error: clientSafeMessage(countError) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ((tradeCount ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            error: `This account still has ${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}. Delete or move them first, or just turn syncing off instead - that keeps everything and stops the account costing you a slot.`,
            hasTrades: true,
            tradeCount: tradeCount ?? 0,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: connectionRow } = await supabase
        .from("user_broker_connections")
        .select("metaapi_account_id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const metaapiAccountId = connectionRow?.metaapi_account_id ?? null;
      if (metaapiAccountId) {
        const metaapiToken = Deno.env.get("METAAPI_TOKEN");
        if (!metaapiToken) {
          return new Response(
            JSON.stringify({
              error: "Account syncing isn't configured, so this account can't be removed safely. Please contact support.",
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        /* Hand it back properly, or keep the row - never lose the pointer. */
        const released = await releaseMetaApiAccount(metaapiAccountId, metaapiToken);
        if (!released.released) {
          console.error(
            "MetaApi release failed, keeping connection row:",
            connection_id,
            metaapiAccountId,
            released.detail,
          );
          return new Response(
            JSON.stringify({
              error: "We couldn't disconnect this account from our sync provider, so it hasn't been deleted. Please try again in a moment.",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { error } = await supabase
        .from("user_broker_connections")
        .delete()
        .eq("id", connection_id)
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: clientSafeMessage(error, "Unknown error") }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/*
  Release parked accounts beyond what the plan allows, oldest first.

  Reads the allowance from parked_account_limit() rather than a number
  written here, so the screen that explains the plan and the rule that
  enforces it cannot disagree.

  Only the MetaApi pointer is cleared. The row stays, because trades
  reference it and because the user should still see the account and its
  history - what they lose is the free instant reconnect, nothing else.
*/
async function releaseOldestParkedOverLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const token = Deno.env.get("METAAPI_TOKEN");
  if (!token) return;

  /*
    Same reason as the slot check: service-role means auth.uid() is null, so
    the auth.uid() version answers 0 - and a parked limit of 0 told this to
    release the account it had just parked. That is how a Pro subscriber's
    first pause deleted the account at MetaApi instead of keeping it.

    A missing answer is treated as "do not trim" rather than "trim
    everything", because releasing is the irreversible direction.
  */
  const { data: limitData } = await supabase.rpc("parked_account_limit_for", { p_user_id: userId } as never);
  if (typeof limitData !== "number") {
    console.error("Could not read the parked-account allowance; leaving parked accounts alone.");
    return;
  }
  const limit = limitData;

  const { data, error } = await supabase
    .from("broker_connections")
    .select("id, metaapi_account_id, sync_paused_at")
    .eq("user_id", userId)
    .not("sync_paused_at", "is", null)
    .not("metaapi_account_id", "is", null)
    .order("sync_paused_at", { ascending: true });

  if (error) return;

  const parked = (data ?? []) as unknown as { id: string; metaapi_account_id: string }[];
  if (parked.length <= limit) return;

  /* Oldest first, which is what the ordering above already gives. */
  for (const row of parked.slice(0, parked.length - limit)) {
    const released = await releaseMetaApiAccount(String(row.metaapi_account_id), token);
    if (!released.released) {
      console.error("Could not release over-limit parked account", row.metaapi_account_id, released.detail);
      continue;
    }
    await supabase
      .from("broker_connections")
      .update({ metaapi_account_id: null } as never)
      .eq("id", row.id);
    console.info("Released parked account over plan limit:", row.metaapi_account_id);
  }
}
