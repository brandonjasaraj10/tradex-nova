import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
        return new Response(JSON.stringify({ error: error.message }), {
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
          broker_id
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
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

      const { error } = await supabase
        .from("user_broker_connections")
        .delete()
        .eq("id", connection_id)
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});