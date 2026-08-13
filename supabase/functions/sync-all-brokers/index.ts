import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SyncEngine } from "../_shared/connectors/syncEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
};

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "default_cron_secret_change_in_production";
const METAAPI_TOKEN = Deno.env.get("METAAPI_TOKEN");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    if (cronSecret !== CRON_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid cron secret" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!METAAPI_TOKEN) {
      throw new Error("METAAPI_TOKEN environment variable is not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const syncEngine = new SyncEngine(supabase, METAAPI_TOKEN);

    console.log("Starting broker sync for all connected accounts...");

    const result = await syncEngine.syncAllConnections();

    console.log(
      `Sync completed: ${result.successful} successful, ${result.failed} failed out of ${result.total} total accounts`
    );

    return new Response(
      JSON.stringify({
        success: true,
        total_accounts: result.total,
        synced_successfully: result.successful,
        failed: result.failed,
        results: result.results.map((r, index) => ({
          success: r.success,
          trades_synced: r.trades_synced,
          error: r.error,
          timestamp: r.timestamp,
        })),
        message: `Synced ${result.successful} of ${result.total} accounts`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync all error:", error);
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
});