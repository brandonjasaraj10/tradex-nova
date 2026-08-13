import { BaseBrokerConnector } from '../baseConnector.ts';
import type { BrokerConnection, RawTrade, ConnectPayload, HealthCheckResult } from '../types.ts';

declare const Deno: {
  env: { get(key: string): string | undefined };
};

function getMetaApiBaseUrl(region: string = 'new-york'): string {
  return `https://mt-provisioning-api-v1.${region}.agiliumtrade.ai`;
}

function getMetaApiClientUrl(region: string = 'new-york'): string {
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
}

function getProxyUrl(): string | null {
  if (typeof Deno !== 'undefined') {
    return Deno.env.get('METAAPI_PROXY_URL') || null;
  }
  return null;
}

interface MetaApiDeal {
  id: string;
  type: string;
  entryType: string;
  symbol: string;
  magic: number;
  time: string;
  brokerTime: string;
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  positionId: string;
  orderId: string;
  comment?: string;
}

export class MetaApiConnector extends BaseBrokerConnector {
  private token: string;
  private region: string;
  private proxyUrl: string | null;

  constructor(token: string, region: string = 'new-york') {
    super();
    this.token = token;
    this.region = region;
    this.proxyUrl = getProxyUrl();
    if (this.proxyUrl) {
      console.log(`Using proxy: ${this.proxyUrl}`);
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null;
    const regions = ['new-york', 'london'];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (const region of regions) {
        try {
          const adjustedUrl = url
            .replace('.new-york.agiliumtrade.ai', `.${region}.agiliumtrade.ai`)
            .replace('.london.agiliumtrade.ai', `.${region}.agiliumtrade.ai`);

          console.log(`Attempt ${attempt}/${maxRetries} (region: ${region})`);

          if (this.proxyUrl) {
            const proxyResponse = await fetch(this.proxyUrl, {
              method: options.method || 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-MetaAPI-Token': this.token,
                'X-Target-URL': adjustedUrl,
              },
              body: options.body,
            });
            return proxyResponse;
          }

          const response = await fetch(adjustedUrl, {
            ...options,
            headers: {
              'auth-token': this.token,
              'User-Agent': 'TradeX/1.0',
              ...options.headers,
            },
          });
          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          const isSSLError = lastError.message.includes('invalid peer certificate') ||
                            lastError.message.includes('SSL') ||
                            lastError.message.includes('certificate') ||
                            lastError.message.includes('UnknownIssuer') ||
                            lastError.message.includes('TLS');

          console.log(`Region ${region} failed: ${lastError.message}`);

          if (!isSSLError) {
            throw lastError;
          }
        }
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.min(2000 * attempt, 8000);
        console.log(`All regions failed, waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(
      'MetaAPI connection failed. Please configure METAAPI_PROXY_URL in your Supabase secrets with a Cloudflare Worker proxy URL.'
    );
  }

  async connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>> {
    const { credentials, settings } = payload;
    const { login, password, server, platform, name } = credentials;

    if (!login || !password || !server || !platform) {
      throw new Error('Missing required credentials: login, password, server, platform');
    }

    const metaApiAccountId = await this.createMetaApiAccount({
      login, password, server, platform,
      name: name || `TradeX_${Date.now()}`,
    });

    await this.deployMetaApiAccount(metaApiAccountId);
    const isConnected = await this.waitForDeployment(metaApiAccountId);

    if (!isConnected) {
      throw new Error('MetaApi account deployment timeout');
    }

    return {
      broker: 'metatrader',
      auth_type: 'metaapi',
      platform,
      metaapi_account_id: metaApiAccountId,
      external_account_id: metaApiAccountId,
      account_id: login,
      username: login,
      server,
      status: 'connected',
      settings_json: settings || {},
    };
  }

  async disconnect(connectionId: string): Promise<void> {}

  async backfill(connection: BrokerConnection, fromDate: Date, toDate: Date): Promise<RawTrade[]> {
    if (!connection.metaapi_account_id) {
      throw new Error('MetaAPI account ID not found');
    }

    console.log(`Starting backfill for ${connection.id}`);
    const accountStatus = await this.getAccountStatus(connection.metaapi_account_id);
    console.log(`Account status: ${accountStatus.connectionStatus}`);

    const trades = await this.getAccountTrades(connection.metaapi_account_id, fromDate.toISOString());
    return this.convertTrades(trades);
  }

  async incrementalSync(connection: BrokerConnection): Promise<RawTrade[]> {
    if (!connection.metaapi_account_id) {
      throw new Error('MetaAPI account ID not found');
    }
    const startTime = connection.last_success_at || connection.last_synced_at;
    const trades = await this.getAccountTrades(connection.metaapi_account_id, startTime);
    return this.convertTrades(trades);
  }

  async healthCheck(connection: BrokerConnection): Promise<HealthCheckResult> {
    if (!connection.metaapi_account_id) {
      return { status: 'error', message: 'MetaAPI account ID not configured' };
    }
    try {
      const response = await this.fetchWithRetry(
        `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${connection.metaapi_account_id}`
      );
      if (!response.ok) {
        return { status: 'error', message: 'Failed to fetch account status' };
      }
      const account = await response.json();
      if (account.connectionStatus === 'CONNECTED') {
        return { status: 'connected', message: 'Account is connected', last_activity: account.lastConnected };
      }
      return { status: 'disconnected', message: `Account status: ${account.connectionStatus}` };
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async createMetaApiAccount(config: {
    login: string; password: string; server: string; platform: string; name: string;
  }): Promise<string> {
    console.log(`Creating MetaAPI account for ${config.login} on ${config.server}`);

    const response = await this.fetchWithRetry(
      `${getMetaApiBaseUrl(this.region)}/users/current/accounts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          type: 'cloud',
          login: config.login,
          password: config.password,
          server: config.server,
          platform: config.platform,
          magic: 0,
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      } catch {
        errorMessage = responseText;
      }
      throw new Error(`Failed to create MetaApi account (${response.status}): ${errorMessage}`);
    }

    const data = JSON.parse(responseText);
    console.log(`Created MetaAPI account: ${data.id}`);
    return data.id;
  }

  private async deployMetaApiAccount(accountId: string): Promise<void> {
    console.log(`Deploying MetaAPI account: ${accountId}`);
    const response = await this.fetchWithRetry(
      `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${accountId}/deploy`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Unknown error';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Failed to deploy MetaApi account (${response.status}): ${errorMessage}`);
    }
    console.log(`MetaAPI account deployed`);
  }

  private async waitForDeployment(accountId: string, maxWaitMs = 60000): Promise<boolean> {
    const startTime = Date.now();
    console.log(`Waiting for MetaAPI account ${accountId} to connect`);

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await this.fetchWithRetry(
          `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${accountId}`,
          {},
          2
        );
        if (response.ok) {
          const account = await response.json();
          console.log(`Account status: ${account.connectionStatus}`);
          if (account.connectionStatus === 'CONNECTED') {
            return true;
          }
        }
      } catch (error) {
        console.log(`Status check failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log(`Deployment timeout`);
    return false;
  }

  private async getAccountStatus(accountId: string): Promise<any> {
    const response = await this.fetchWithRetry(
      `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${accountId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch account status: ${response.status}`);
    }
    return await response.json();
  }

  private async getAccountTrades(accountId: string, startTime?: string): Promise<MetaApiDeal[]> {
    const endTime = new Date().toISOString();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const start = startTime || twoYearsAgo.toISOString();

    const url = `${getMetaApiClientUrl(this.region)}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(endTime)}`;
    console.log(`Fetching trades from ${start}`);

    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch trades: ${error}`);
    }

    const data = await response.json();
    const deals = Array.isArray(data) ? data : (data.deals || []);
    console.log(`Received ${deals.length} deals`);
    return deals;
  }

  private convertTrades(deals: MetaApiDeal[]): RawTrade[] {
    console.log(`Converting ${deals.length} deals`);

    const tradesByPosition = new Map<string, { entry?: MetaApiDeal; exit?: MetaApiDeal }>();

    for (const deal of deals) {
      const posId = deal.positionId;
      if (!posId) continue;

      if (!tradesByPosition.has(posId)) {
        tradesByPosition.set(posId, {});
      }

      const position = tradesByPosition.get(posId)!;
      if (deal.entryType === 'DEAL_ENTRY_IN') {
        position.entry = deal;
      } else if (deal.entryType === 'DEAL_ENTRY_OUT') {
        position.exit = deal;
      }
    }

    const trades: RawTrade[] = [];
    for (const [positionId, { entry, exit }] of tradesByPosition) {
      if (!entry) continue;

      const isLong = entry.type.includes('BUY');
      const isClosed = !!exit;

      trades.push({
        external_trade_id: `metaapi_${positionId}`,
        symbol: entry.symbol,
        side: isLong ? 'buy' : 'sell',
        open_time: new Date(entry.time).toISOString(),
        close_time: isClosed ? new Date(exit.time).toISOString() : undefined,
        lots: entry.volume,
        quantity: entry.volume,
        entry_price: entry.price,
        exit_price: exit?.price,
        pnl: isClosed ? exit.profit : 0,
        commission: (entry.commission || 0) + (exit?.commission || 0),
        swap: (entry.swap || 0) + (exit?.swap || 0),
        duration_seconds: isClosed
          ? this.calculateDuration(new Date(entry.time).toISOString(), new Date(exit.time).toISOString())
          : undefined,
        raw_json: { entry, exit },
      });
    }

    console.log(`Converted to ${trades.length} trades`);
    return trades;
  }
}