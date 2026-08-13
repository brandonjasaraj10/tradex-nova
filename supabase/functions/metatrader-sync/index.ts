import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SyncEngine } from "./_shared/connectors/syncEngine.ts";
import { MetaApiConnector } from "./_shared/connectors/metatrader/metaapiConnector.ts";
import type { ConnectPayload } from "./_shared/connectors/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const METAAPI_TOKEN = Deno.env.get("METAAPI_TOKEN");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!METAAPI_TOKEN) {
      console.error("METAAPI_TOKEN is not set");
      return new Response(
        JSON.stringify({
          error: "MetaAPI Configuration Required",
          details: "The METAAPI_TOKEN secret needs to be configured in your Supabase project.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
    const pathname = url.pathname.replace("/metatrader-sync", "");
    const syncEngine = new SyncEngine(supabase, METAAPI_TOKEN);

    if (pathname === "/connect" && req.method === "POST") {
      const body = await req.json();
      const { broker_id, account_name, platform, server, login, password } = body;

      if (!platform || !server || !login || !password) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: platform, server, login, password" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const detectedRegion = server.toLowerCase().includes('london') || server.toLowerCase().includes('uk') || server.toLowerCase().includes('europe')
        ? 'london'
        : 'new-york';

      const { data: connection, error: insertError } = await supabase
        .from("user_broker_connections")
        .insert({
          user_id: user.id,
          broker: 'metatrader',
          auth_type: 'metaapi',
          broker_id: broker_id,
          account_name: account_name || `${platform.toUpperCase()} - ${login}`,
          connection_type: "credentials",
          username: login,
          password: password,
          server: server,
          platform: platform,
          metaapi_region: detectedRegion,
          status: "connecting",
          is_auto_sync_enabled: true,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Database error: ${insertError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        const connector = new MetaApiConnector(METAAPI_TOKEN, detectedRegion);

        const connectPayload: ConnectPayload = {
          user_id: user.id,
          broker: 'metatrader',
          auth_type: 'metaapi',
          credentials: {
            login,
            password,
            server,
            platform,
            name: `TradeX_${connection.id}`,
          },
        };

        const connectionData = await connector.connect(connectPayload);

        await supabase
          .from("user_broker_connections")
          .update({
            metaapi_account_id: connectionData.metaapi_account_id,
            external_account_id: connectionData.external_account_id,
            status: connectionData.status,
          })
          .eq("id", connection.id);

        const result = await syncEngine.syncConnection(connection.id, 'backfill', true);

        return new Response(
          JSON.stringify({
            success: result.success,
            connection_id: connection.id,
            metaapi_account_id: connectionData.metaapi_account_id,
            trades_imported: result.trades_synced,
            message: `Successfully connected and imported ${result.trades_synced} trades`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        await supabase
          .from("user_broker_connections")
          .update({
            status: "error",
            last_error: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({
            error: "Failed to connect MetaTrader account",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (pathname === "/sync" && req.method === "POST") {
      const body = await req.json();
      const { connection_id, mode, enable_audit } = body;

      if (!connection_id) {
        return new Response(
          JSON.stringify({ error: "Missing connection_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: ownedConnection } = await supabase
        .from("user_broker_connections")
        .select("id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!ownedConnection) {
        return new Response(
          JSON.stringify({ error: "Connection not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        const result = await syncEngine.syncConnection(connection_id, mode || 'incremental', enable_audit === true);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Sync failed",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (pathname === "/diagnose" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(
          JSON.stringify({ error: "Missing connection_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        const { data: connection } = await supabase
          .from("user_broker_connections")
          .select("*")
          .eq("id", connection_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!connection) {
          return new Response(
            JSON.stringify({ error: "Connection not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            connection: {
              id: connection.id,
              status: connection.status,
              platform: connection.platform,
              server: connection.server,
              metaapi_account_id: connection.metaapi_account_id,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Diagnosis failed",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});