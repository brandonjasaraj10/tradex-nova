import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

interface MT4Trade {
  ticket: number;
  symbol: string;
  order_type: number;
  lots: number;
  open_price: number;
  open_time: string;
  close_price?: number;
  close_time?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  comment?: string;
}

interface WebhookPayload {
  account_number: string;
  webhook_secret: string;
  server: string;
  trades: MT4Trade[];
}

function mapMT4OrderType(orderType: number): { side: string; asset_class: string } {
  switch (orderType) {
    case 0:
      return { side: 'buy', asset_class: 'forex' };
    case 1:
      return { side: 'sell', asset_class: 'forex' };
    case 2:
    case 3:
    case 4:
    case 5:
      return { side: orderType === 2 || orderType === 4 ? 'buy' : 'sell', asset_class: 'forex' };
    default:
      return { side: 'buy', asset_class: 'forex' };
  }
}

function determineSide(orderType: number): string {
  return orderType === 0 || orderType === 2 || orderType === 4 ? 'long' : 'short';
}

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

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();
    const { account_number, webhook_secret, server, trades } = payload;

    if (!account_number || !webhook_secret || !trades) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: account_number, webhook_secret, trades" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Webhook received for account: ${account_number}, trades: ${trades.length}`);

    const { data: connection, error: connError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id, webhook_secret")
      .eq("username", account_number)
      .eq("server", server)
      .eq("status", "connected")
      .maybeSingle();

    if (connError) {
      console.error("Database error:", connError);
      return new Response(
        JSON.stringify({ error: "Database error", details: connError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!connection) {
      return new Response(
        JSON.stringify({ error: "Connection not found. Please ensure your account is connected in TradeX." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (connection.webhook_secret !== webhook_secret) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const trade of trades) {
      try {
        const { side, asset_class } = mapMT4OrderType(trade.order_type);
        const direction = determineSide(trade.order_type);
        const isClosed = !!trade.close_time && !!trade.close_price;

        const tradeData = {
          user_id: connection.user_id,
          broker_connection_id: connection.id,
          broker_trade_id: `mt4_${trade.ticket}`,
          symbol: trade.symbol,
          asset_class,
          side,
          direction,
          entry_time: new Date(trade.open_time).toISOString(),
          entry_date: new Date(trade.open_time).toISOString(),
          entry_price: trade.open_price,
          exit_time: isClosed ? new Date(trade.close_time!).toISOString() : null,
          exit_date: isClosed ? new Date(trade.close_time!).toISOString() : new Date(trade.open_time).toISOString(),
          exit_price: trade.close_price || null,
          quantity: trade.lots,
          pnl: trade.profit || null,
          fees: (trade.swap || 0) + (trade.commission || 0),
          commission: trade.commission || 0,
          raw_broker_payload: trade,
          notes: trade.comment || null,
        };

        const { error: upsertError } = await supabase
          .from("trades")
          .upsert(tradeData, {
            onConflict: "user_id,broker_connection_id,broker_trade_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          errors.push(`Trade ${trade.ticket}: ${upsertError.message}`);
        } else {
          imported++;
        }
      } catch (error) {
        errors.push(`Trade ${trade.ticket}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const { count } = await supabase
      .from("trades")
      .select("*", { count: "exact", head: true })
      .eq("broker_connection_id", connection.id);

    await supabase
      .from("user_broker_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        trades_count: count || 0,
      })
      .eq("id", connection.id);

    console.log(`Sync complete: ${imported} trades imported, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${imported} trades`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
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