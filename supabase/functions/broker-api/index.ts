import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";
import { parkMetaApiAccount, releaseMetaApiAccount } from "../_shared/metaApiAccount.ts";

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
          broker_type
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

    if (pathname === "/disconnect" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      /*
        Trades block deletion, so say so before trying.

        trades.broker_id references broker_connections with NO ACTION, so
        Postgres refuses to delete an account that still has any - it does not
        cascade and it does not null them out. The delete simply failed, the
        client logged it to the console, and the account stayed in the list
        with nothing on screen explaining why. Someone would press it again
        and again.

        Counting first lets the message name the actual obstacle and the
        number, instead of surfacing a foreign key violation. Journal entries
        need no such check: their reference is ON DELETE SET NULL, so they
        survive the account and reappear under All Accounts.

        This check became load-bearing when removal stopped being a delete.
        The foreign key used to refuse the operation on its own; a retained
        row never trips it, so nothing but this stands between a user and
        trades that quietly vanish from every screen while still sitting in
        the database under a hidden account.
      */
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
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
        Park the account rather than destroying it.

        MetaApi charges $2.10 to add a trading account to its cloud. It is
        per account created, it is never refunded, and re-adding pays it
        again - a real invoice billed it twice for one broker account
        reconnected ten minutes later. Undeployed storage is about $0.73 a
        month. So for anyone returning inside roughly three months, keeping
        the account is the cheaper choice, and it spares them digging out an
        investor password we deliberately never store.

        Undeploy stops the expensive part: $8.64 a month running becomes
        $0.73 a month registered. Then the row is marked removed rather than
        deleted, which is what makes the account vanish from their list
        while still pointing at the MetaApi account - so the orphan sweep
        knows it is spoken for and leaves it alone.

        If MetaApi will not undeploy, nothing is marked. An account that
        still appears in the list and can be removed again is a far better
        outcome than one that has vanished from the UI while quietly running
        at full price.
      */
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

        const parked = await parkMetaApiAccount(metaapiAccountId, metaapiToken);
        if (!parked.released) {
          console.error(
            "MetaApi undeploy failed, leaving connection in place:",
            connection_id,
            metaapiAccountId,
            parked.detail,
          );
          return new Response(
            JSON.stringify({
              error: "We couldn't stop this account with our sync provider, so it hasn't been removed. Please try again in a moment.",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      /*
        Marked, not deleted. Auto-sync off as well as removed_at set, so a
        scheduled run has two independent reasons to skip it.
      */
      const { error } = await supabase
        .from("broker_connections")
        .update({ removed_at: new Date().toISOString(), is_auto_sync_enabled: false })
        .eq("id", connection_id)
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: clientSafeMessage(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      /*
        Keeping parked accounts is cheap, not free.

        Each one is about $0.73 a month, and the 120-day retirement is the
        only other thing that removes them. A trader cycling through ten
        blown prop accounts a month would sit on forty before the first
        expired - $29 a month of nothing. So the plan's allowance caps it,
        and past the cap the oldest is released early.

        The user loses nothing they can see: their trades, journal entries
        and the account itself all stay. The only consequence is that
        reconnecting that particular account later pays MetaApi's $2.10
        again instead of being free.

        Best effort. A failure here costs cents and must never turn a
        successful removal into an error the user has to act on.
      */
      try {
        /* Cast for the same reason elsewhere in this project: the untyped
           client's generics do not survive a function boundary. */
        await releaseOldestParkedOverLimit(supabase as never, user.id);
      } catch (e) {
        console.error("Parked-account trim failed (continuing):", user.id, e);
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

  const { data: limitData } = await supabase.rpc("parked_account_limit");
  const limit = typeof limitData === "number" ? limitData : 0;

  const { data, error } = await supabase
    .from("broker_connections")
    .select("id, metaapi_account_id, removed_at")
    .eq("user_id", userId)
    .not("removed_at", "is", null)
    .not("metaapi_account_id", "is", null)
    .order("removed_at", { ascending: true });

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
