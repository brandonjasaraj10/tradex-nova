import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Trade {
  broker_trade_id: string;
  symbol: string;
  asset_class: 'stock' | 'forex' | 'future' | 'crypto' | 'option';
  side: 'buy' | 'sell' | 'long' | 'short';
  entry_time: Date;
  exit_time: Date | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  fees: number | null;
  commission: number | null;
  raw_broker_payload: Record<string, unknown>;
}

interface BrokerCredentials {
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
  username?: string;
  password?: string;
  server?: string;
}

interface IBrokerAdapter {
  fetchTradesSince(since: Date): Promise<Trade[]>;
  testConnection(): Promise<boolean>;
}

abstract class BaseBrokerAdapter implements IBrokerAdapter {
  protected credentials: BrokerCredentials;

  constructor(credentials: BrokerCredentials) {
    this.credentials = credentials;
  }

  abstract fetchTradesSince(since: Date): Promise<Trade[]>;
  abstract testConnection(): Promise<boolean>;

  protected calculatePnL(
    side: string,
    entryPrice: number,
    exitPrice: number | null,
    quantity: number,
    fees: number = 0,
    commission: number = 0
  ): number | null {
    if (!exitPrice) return null;
    const multiplier = side === 'long' || side === 'buy' ? 1 : -1;
    const priceDiff = (exitPrice - entryPrice) * multiplier;
    const grossPnL = priceDiff * quantity;
    return grossPnL - fees - commission;
  }
}

class BybitAdapter extends BaseBrokerAdapter {
  private readonly baseUrl = 'https://api.bybit.com';

  async fetchTradesSince(since: Date): Promise<Trade[]> {
    try {
      const sinceMs = since.getTime();
      const response = await fetch(
        `${this.baseUrl}/v5/execution/list?category=spot&startTime=${sinceMs}&limit=100`,
        {
          headers: {
            'X-BAPI-API-KEY': this.credentials.api_key || '',
            'X-BAPI-TIMESTAMP': Date.now().toString(),
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const executions = data.result?.list || [];
      const tradesMap = new Map<string, any>();

      for (const exec of executions) {
        const orderId = exec.orderId;
        if (!tradesMap.has(orderId)) {
          tradesMap.set(orderId, { entries: [], exits: [] });
        }
        const trade = tradesMap.get(orderId)!;
        if (exec.side === 'Buy') {
          trade.entries.push(exec);
        } else {
          trade.exits.push(exec);
        }
      }

      const trades: Trade[] = [];
      for (const [orderId, tradeData] of tradesMap.entries()) {
        if (tradeData.entries.length === 0) continue;
        const entry = tradeData.entries[0];
        const exit = tradeData.exits[0] || null;

        trades.push({
          broker_trade_id: orderId,
          symbol: entry.symbol,
          asset_class: 'crypto',
          side: entry.side === 'Buy' ? 'long' : 'short',
          entry_time: new Date(parseInt(entry.execTime)),
          exit_time: exit ? new Date(parseInt(exit.execTime)) : null,
          entry_price: parseFloat(entry.execPrice),
          exit_price: exit ? parseFloat(exit.execPrice) : null,
          quantity: parseFloat(entry.execQty),
          pnl: exit ? this.calculatePnL(
            entry.side === 'Buy' ? 'long' : 'short',
            parseFloat(entry.execPrice),
            parseFloat(exit.execPrice),
            parseFloat(entry.execQty),
            parseFloat(entry.execFee || 0),
            0
          ) : null,
          fees: parseFloat(entry.execFee || 0),
          commission: 0,
          raw_broker_payload: { entry, exit },
        });
      }

      return trades;
    } catch (error) {
      console.error('Bybit adapter error:', error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`, {
        headers: {
          'X-BAPI-API-KEY': this.credentials.api_key || '',
          'X-BAPI-TIMESTAMP': Date.now().toString(),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class OandaAdapter extends BaseBrokerAdapter {
  private readonly baseUrl: string;

  constructor(credentials: BrokerCredentials) {
    super(credentials);
    this.baseUrl = credentials.account_id?.startsWith('101')
      ? 'https://api-fxpractice.oanda.com'
      : 'https://api-fxtrade.oanda.com';
  }

  async fetchTradesSince(since: Date): Promise<Trade[]> {
    try {
      const sinceISO = since.toISOString();
      const response = await fetch(
        `${this.baseUrl}/v3/accounts/${this.credentials.account_id}/transactions?from=${sinceISO}&type=ORDER_FILL`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const transactions = data.transactions || [];
      const tradesMap = new Map<string, any[]>();

      for (const tx of transactions) {
        if (tx.type !== 'ORDER_FILL') continue;
        const tradeId = tx.tradeOpened?.tradeID || tx.tradeReduced?.tradeID || tx.id;
        if (!tradesMap.has(tradeId)) {
          tradesMap.set(tradeId, []);
        }
        tradesMap.get(tradeId)!.push(tx);
      }

      const trades: Trade[] = [];
      for (const [tradeId, fills] of tradesMap.entries()) {
        const entry = fills[0];
        const exit = fills.length > 1 ? fills[fills.length - 1] : null;
        const units = parseFloat(entry.units);
        const side = units > 0 ? 'long' : 'short';

        trades.push({
          broker_trade_id: tradeId,
          symbol: entry.instrument.replace('_', '/'),
          asset_class: 'forex',
          side,
          entry_time: new Date(entry.time),
          exit_time: exit ? new Date(exit.time) : null,
          entry_price: parseFloat(entry.price),
          exit_price: exit ? parseFloat(exit.price) : null,
          quantity: Math.abs(units),
          pnl: exit ? parseFloat(exit.pl || 0) : null,
          fees: 0,
          commission: parseFloat(entry.commission || 0),
          raw_broker_payload: { entry, exit },
        });
      }

      return trades;
    } catch (error) {
      console.error('Oanda adapter error:', error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v3/accounts/${this.credentials.account_id}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

class PropFirmAdapter extends BaseBrokerAdapter {
  async fetchTradesSince(since: Date): Promise<Trade[]> {
    return [];
  }

  async testConnection(): Promise<boolean> {
    if (this.credentials.username && this.credentials.password) {
      return true;
    }
    return false;
  }
}

class GenericAdapter extends BaseBrokerAdapter {
  async fetchTradesSince(since: Date): Promise<Trade[]> {
    return [];
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

function createBrokerAdapter(brokerSlug: string, credentials: BrokerCredentials): IBrokerAdapter {
  const propFirms = ['ftmo', 'the5ers', 'myforexfunds', 'thefundedtrader', 'trueforexfunds', 'fundednext', 'topstep', 'earn2trade'];
  if (propFirms.includes(brokerSlug)) {
    return new PropFirmAdapter(credentials);
  }

  switch (brokerSlug) {
    case 'bybit':
      return new BybitAdapter(credentials);
    case 'oanda':
      return new OandaAdapter(credentials);
    case 'metatrader-4':
    case 'metatrader-5':
      return new PropFirmAdapter(credentials);
    default:
      return new GenericAdapter(credentials);
  }
}

interface SyncResult {
  success: boolean;
  tradesImported: number;
  tradesUpdated: number;
  error?: string;
}

class SyncEngine {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async syncBrokerConnection(connectionId: string): Promise<SyncResult> {
    try {
      const { data: connection, error: connError } = await this.supabase
        .from('user_broker_connections')
        .select(`
          id,
          user_id,
          account_name,
          connection_type,
          api_key,
          api_secret,
          access_token,
          refresh_token,
          account_id,
          username,
          password,
          server,
          last_synced_at,
          status,
          brokers (
            id,
            slug,
            name
          )
        `)
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return {
          success: false,
          tradesImported: 0,
          tradesUpdated: 0,
          error: `Connection not found: ${connError?.message}`,
        };
      }

      if (connection.status === 'error' || connection.status === 'disconnected') {
        return {
          success: false,
          tradesImported: 0,
          tradesUpdated: 0,
          error: 'Connection is not active',
        };
      }

      // Skip sync if no broker is associated (manual accounts)
      if (!connection.brokers) {
        return {
          success: false,
          tradesImported: 0,
          tradesUpdated: 0,
          error: 'No broker associated with this account. Please upload trades manually.',
        };
      }

      const broker = connection.brokers;
      const adapter = createBrokerAdapter(broker.slug, {
        api_key: connection.api_key || undefined,
        api_secret: connection.api_secret || undefined,
        access_token: connection.access_token || undefined,
        refresh_token: connection.refresh_token || undefined,
        account_id: connection.account_id || undefined,
        username: connection.username || undefined,
        password: connection.password || undefined,
        server: connection.server || undefined,
      });

      const lastSyncDate = connection.last_synced_at
        ? new Date(connection.last_synced_at)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const brokerTrades = await adapter.fetchTradesSince(lastSyncDate);
      let imported = 0;

      for (const trade of brokerTrades) {
        const tradeData = {
          user_id: connection.user_id,
          broker_connection_id: connection.id,
          broker_trade_id: trade.broker_trade_id,
          symbol: trade.symbol,
          asset_class: trade.asset_class,
          side: trade.side,
          entry_time: trade.entry_time.toISOString(),
          exit_time: trade.exit_time?.toISOString() || null,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          quantity: trade.quantity,
          pnl: trade.pnl,
          fees: trade.fees,
          commission: trade.commission,
          raw_broker_payload: trade.raw_broker_payload,
          entry_date: trade.entry_time.toISOString(),
          exit_date: trade.exit_time?.toISOString() || trade.entry_time.toISOString(),
          direction: trade.side,
        };

        const { error: tradeError } = await this.supabase
          .from('trades')
          .upsert(tradeData, {
            onConflict: 'user_id,broker_connection_id,broker_trade_id',
            ignoreDuplicates: false,
          });

        if (!tradeError) {
          imported++;
        }
      }

      const { count } = await this.supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('broker_connection_id', connectionId);

      await this.supabase
        .from('user_broker_connections')
        .update({
          status: 'connected',
          last_synced_at: new Date().toISOString(),
          last_error: null,
          trades_count: count || 0,
        })
        .eq('id', connectionId);

      return {
        success: true,
        tradesImported: imported,
        tradesUpdated: 0,
      };
    } catch (error) {
      await this.supabase
        .from('user_broker_connections')
        .update({
          status: 'error',
          last_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', connectionId);

      return {
        success: false,
        tradesImported: 0,
        tradesUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      const { data: connection, error } = await this.supabase
        .from('user_broker_connections')
        .select(`
          id,
          api_key,
          api_secret,
          access_token,
          refresh_token,
          account_id,
          username,
          password,
          server,
          brokers (
            slug
          )
        `)
        .eq('id', connectionId)
        .single();

      if (error || !connection) return false;

      // Manual accounts without broker cannot be tested
      if (!connection.brokers) return false;

      const broker = connection.brokers;
      const adapter = createBrokerAdapter(broker.slug, {
        api_key: connection.api_key || undefined,
        api_secret: connection.api_secret || undefined,
        access_token: connection.access_token || undefined,
        refresh_token: connection.refresh_token || undefined,
        account_id: connection.account_id || undefined,
        username: connection.username || undefined,
        password: connection.password || undefined,
        server: connection.server || undefined,
      });

      return await adapter.testConnection();
    } catch {
      return false;
    }
  }
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
          connection_type,
          status,
          last_synced_at,
          last_error,
          trades_count,
          created_at,
          username,
          server,
          webhook_secret,
          metaapi_account_id,
          auth_type,
          platform,
          is_auto_sync_enabled,
          starting_balance,
          current_balance,
          currency,
          ownership_type,
          last_balance_update,
          brokers (
            id,
            name,
            slug,
            category,
            logo_url,
            supports_auto_sync
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const enrichedConnections = connections?.map(conn => ({
        ...conn,
        webhook_url: `${supabaseUrl}/functions/v1/mt4-webhook`,
      }));

      return new Response(JSON.stringify({ connections: enrichedConnections }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pathname === "/connect" && req.method === "POST") {
      const body = await req.json();
      const {
        broker_id,
        broker_slug,
        account_name,
        account_type,
        connection_type,
        api_key,
        api_secret,
        access_token,
        refresh_token,
        account_id,
        username,
        password,
        server,
        starting_balance,
        currency,
        ownership_type,
      } = body;

      let brokerId = broker_id;
      if (!brokerId && broker_slug) {
        const { data: broker } = await supabase
          .from("brokers")
          .select("id")
          .eq("slug", broker_slug)
          .single();
        brokerId = broker?.id;
      }

      if (!brokerId) {
        return new Response(JSON.stringify({ error: "Broker not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connection, error } = await supabase
        .from("user_broker_connections")
        .insert({
          user_id: user.id,
          broker_id: brokerId,
          account_name: account_name || "",
          account_type: account_type || "live",
          connection_type: connection_type || "api_key",
          api_key: api_key || null,
          api_secret: api_secret || null,
          access_token: access_token || null,
          refresh_token: refresh_token || null,
          account_id: account_id || null,
          username: username || null,
          password: password || null,
          server: server || null,
          starting_balance: starting_balance || 0,
          current_balance: starting_balance || 0,
          currency: currency || "USD",
          ownership_type: ownership_type || "personal",
          status: "disconnected",
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const syncEngine = new SyncEngine(supabaseUrl, supabaseKey);
      const isValid = await syncEngine.testConnection(connection.id);

      await supabase
        .from("user_broker_connections")
        .update({ status: isValid ? "connected" : "error" })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({
          connection: { ...connection, status: isValid ? "connected" : "error" },
          valid: isValid,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (pathname === "/test" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connection } = await supabase
        .from("user_broker_connections")
        .select("id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .single();

      if (!connection) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const syncEngine = new SyncEngine(supabaseUrl, supabaseKey);
      const isValid = await syncEngine.testConnection(connection_id);

      return new Response(
        JSON.stringify({
          status: isValid ? "ok" : "error",
          message: isValid ? "Connection successful" : "Connection failed",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (pathname === "/sync" && req.method === "POST") {
      const body = await req.json();
      const { connection_id } = body;

      if (!connection_id) {
        return new Response(JSON.stringify({ error: "connection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connection } = await supabase
        .from("user_broker_connections")
        .select("id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .single();

      if (!connection) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const syncEngine = new SyncEngine(supabaseUrl, supabaseKey);
      const result = await syncEngine.syncBrokerConnection(connection_id);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
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