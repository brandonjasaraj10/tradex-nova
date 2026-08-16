import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedTrade {
  ticket: string;
  symbol: string;
  type: string;
  volume: number;
  openTime: string;
  openPrice: number;
  closeTime?: string;
  closePrice?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  comment?: string;
}

function parseHTMLStatement(html: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];

  const tradePattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let match;
  while ((match = tradePattern.exec(html)) !== null) {
    const row = match[1];
    const cells: string[] = [];

    let cellMatch;
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
      cells.push(cellContent);
    }

    if (cells.length >= 10 && cells[0] && !isNaN(Number(cells[0]))) {
      const trade: ParsedTrade = {
        ticket: cells[0],
        symbol: cells[2] || '',
        type: cells[3] || '',
        volume: parseFloat(cells[4]) || 0,
        openTime: cells[1] || '',
        openPrice: parseFloat(cells[5]) || 0,
        closeTime: cells[6],
        closePrice: parseFloat(cells[7]) || undefined,
        profit: parseFloat(cells[8]) || undefined,
        commission: parseFloat(cells[9]) || 0,
        swap: parseFloat(cells[10]) || 0,
        comment: cells[11] || '',
      };

      if (trade.ticket && trade.symbol) {
        trades.push(trade);
      }
    }
  }

  return trades;
}

function parseCSVStatement(csv: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  const lines = csv.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    if (parts.length < 10) continue;

    const clean = (str: string) => str.replace(/^"|"$/g, '').trim();

    const ticket = clean(parts[0]);
    if (!ticket || isNaN(Number(ticket))) continue;

    const trade: ParsedTrade = {
      ticket,
      openTime: clean(parts[1]),
      symbol: clean(parts[2]),
      type: clean(parts[3]),
      volume: parseFloat(clean(parts[4])) || 0,
      openPrice: parseFloat(clean(parts[5])) || 0,
      closeTime: clean(parts[6]) || undefined,
      closePrice: parseFloat(clean(parts[7])) || undefined,
      profit: parseFloat(clean(parts[8])) || undefined,
      commission: parseFloat(clean(parts[9])) || 0,
      swap: parseFloat(clean(parts[10])) || 0,
      comment: clean(parts[11]) || '',
    };

    if (trade.symbol) {
      trades.push(trade);
    }
  }

  return trades;
}

function determineSide(type: string): string {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('buy')) return 'long';
  if (lowerType.includes('sell')) return 'short';
  return 'long';
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

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const connectionId = formData.get("connection_id") as string;

    if (!file || !connectionId) {
      return new Response(
        JSON.stringify({ error: "File and connection_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: connection, error: connError } = await supabase
      .from("user_broker_connections")
      .select("id, user_id")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const content = await file.text();
    const fileName = file.name.toLowerCase();

    let parsedTrades: ParsedTrade[] = [];

    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      parsedTrades = parseHTMLStatement(content);
    } else if (fileName.endsWith('.csv')) {
      parsedTrades = parseCSVStatement(content);
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file format. Please upload HTML or CSV" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (parsedTrades.length === 0) {
      return new Response(
        JSON.stringify({ error: "No trades found in file. Please ensure it's a valid MT4/MT5 statement." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const trade of parsedTrades) {
      try {
        const side = determineSide(trade.type);
        const isClosed = !!trade.closeTime && !!trade.closePrice;
        const direction = side === 'long' ? 'LONG' : 'SHORT';

        const tradeData = {
          user_id: user.id,
          broker_id: connectionId,
          symbol: trade.symbol,
          direction,
          entry_date: new Date(trade.openTime).toISOString(),
          entry_price: trade.openPrice,
          exit_date: isClosed && trade.closeTime ? new Date(trade.closeTime).toISOString() : new Date(trade.openTime).toISOString(),
          exit_price: trade.closePrice || null,
          quantity: trade.volume,
          pnl: trade.profit ?? null,
          fees: (trade.swap || 0) + (trade.commission || 0),
          notes: trade.comment || null,
        };

        const { error: insertError } = await supabase
          .from("trades")
          .insert(tradeData);

        if (insertError) {
          errors.push(`Trade ${trade.ticket}: ${insertError.message}`);
          skipped++;
        } else {
          imported++;
        }
      } catch (error) {
        errors.push(`Trade ${trade.ticket}: ${clientSafeMessage(error, 'Unknown error')}`);
        skipped++;
      }
    }

    const { error: syncUpdateError } = await supabase
      .from("user_broker_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId);

    if (syncUpdateError) {
      console.error("Failed to update last_sync:", syncUpdateError);
    }

    const { error: notifyError } = await supabase.from("notifications").insert({
      user_id: user.id,
      title: skipped === 0 ? "Import complete" : "Import finished with some errors",
      message: `Imported ${imported} of ${parsedTrades.length} trades from your statement.${
        skipped > 0 ? ` ${skipped} rows were skipped.` : ""
      }`,
      type: skipped === 0 ? "success" : "warning",
    });

    if (notifyError) {
      console.error("Failed to create import notification:", notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        total: parsedTrades.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        message: `Successfully imported ${imported} of ${parsedTrades.length} trades`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to import statement",
        details: clientSafeMessage(error, "Unknown error"),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});