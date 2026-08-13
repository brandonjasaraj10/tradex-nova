import { BaseBrokerConnector } from '../baseConnector.ts';
import type {
  BrokerConnection,
  RawTrade,
  ConnectPayload,
  HealthCheckResult,
} from '../types.ts';

function getMetaApiBaseUrl(region: string = 'new-york'): string {
  return `https://mt-provisioning-api-v1.${region}.agiliumtrade.ai`;
}

function getMetaApiClientUrl(region: string = 'new-york'): string {
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
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

  constructor(token: string, region: string = 'new-york') {
    super();
    this.token = token;
    this.region = region;
  }

  async connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>> {
    const { user_id, credentials, settings } = payload;
    const { login, password, server, platform, name } = credentials;

    if (!login || !password || !server || !platform) {
      throw new Error('Missing required credentials: login, password, server, platform');
    }

    const metaApiAccountId = await this.createMetaApiAccount({
      login,
      password,
      server,
      platform,
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

  async disconnect(connectionId: string): Promise<void> {
  }

  async backfill(
    connection: BrokerConnection,
    fromDate: Date,
    toDate: Date
  ): Promise<RawTrade[]> {
    if (!connection.metaapi_account_id) {
      throw new Error('MetaAPI account ID not found');
    }

    const trades = await this.getAccountTrades(
      connection.metaapi_account_id,
      fromDate.toISOString()
    );

    return this.convertTrades(trades);
  }

  async incrementalSync(connection: BrokerConnection): Promise<RawTrade[]> {
    if (!connection.metaapi_account_id) {
      throw new Error('MetaAPI account ID not found');
    }

    const startTime = connection.last_success_at || connection.last_synced_at;
    const trades = await this.getAccountTrades(
      connection.metaapi_account_id,
      startTime
    );

    return this.convertTrades(trades);
  }

  async healthCheck(connection: BrokerConnection): Promise<HealthCheckResult> {
    if (!connection.metaapi_account_id) {
      return {
        status: 'error',
        message: 'MetaAPI account ID not configured',
      };
    }

    try {
      const response = await fetch(
        `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${connection.metaapi_account_id}`,
        {
          headers: {
            'auth-token': this.token,
          },
        }
      );

      if (!response.ok) {
        return {
          status: 'error',
          message: 'Failed to fetch account status',
        };
      }

      const account = await response.json();

      if (account.connectionStatus === 'CONNECTED') {
        return {
          status: 'connected',
          message: 'Account is connected',
          last_activity: account.lastConnected,
        };
      }

      return {
        status: 'disconnected',
        message: `Account status: ${account.connectionStatus}`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async createMetaApiAccount(config: {
    login: string;
    password: string;
    server: string;
    platform: string;
    name: string;
  }): Promise<string> {
    const response = await fetch(`${getMetaApiBaseUrl(this.region)}/users/current/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth-token': this.token,
      },
      body: JSON.stringify({
        name: config.name,
        type: 'cloud',
        login: config.login,
        password: config.password,
        server: config.server,
        platform: config.platform,
        magic: 0,
      }),
    });

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
    return data.id;
  }

  private async deployMetaApiAccount(accountId: string): Promise<void> {
    const response = await fetch(
      `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${accountId}/deploy`,
      {
        method: 'POST',
        headers: {
          'auth-token': this.token,
        },
      }
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
  }

  private async waitForDeployment(
    accountId: string,
    maxWaitMs = 60000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(
        `${getMetaApiBaseUrl(this.region)}/users/current/accounts/${accountId}`,
        {
          headers: {
            'auth-token': this.token,
          },
        }
      );

      if (response.ok) {
        const account = await response.json();
        if (account.connectionStatus === 'CONNECTED') {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
  }

  private async getAccountTrades(
    accountId: string,
    startTime?: string
  ): Promise<MetaApiDeal[]> {
    const endTime = new Date().toISOString();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const start = startTime || twoYearsAgo.toISOString();

    const url = `${getMetaApiClientUrl(this.region)}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(endTime)}`;

    console.log(`Fetching trades from ${start} to ${endTime}`);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'auth-token': this.token,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to fetch trades: ${error}`);
        }

        const data = await response.json();
        const deals = Array.isArray(data) ? data : (data.deals || []);
        console.log(`Received ${deals.length} deals from MetaAPI`);
        return deals;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        const isSSLError = lastError.message.includes('invalid peer certificate') ||
                          lastError.message.includes('SSL') ||
                          lastError.message.includes('certificate') ||
                          lastError.message.includes('Expired');

        if (isSSLError && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`SSL error on attempt ${attempt}/${maxRetries}, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        if (isSSLError) {
          throw new Error(
            'MetaAPI SSL certificate error. This is a temporary infrastructure issue on MetaAPI\'s side. Please wait 2-3 minutes and try again. If the issue persists after 10 minutes, contact support.'
          );
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Failed after retries');
  }

  private convertTrades(deals: MetaApiDeal[]): RawTrade[] {
    console.log(`Converting ${deals.length} deals to trades`);

    if (deals.length > 0) {
      console.log('Sample deal structure:', JSON.stringify(deals[0], null, 2));
    }

    const tradesByPosition = new Map<string, { entry?: MetaApiDeal; exit?: MetaApiDeal }>();
    let entryCount = 0;
    let exitCount = 0;
    let otherCount = 0;

    for (const deal of deals) {
      const posId = deal.positionId;

      if (!posId) {
        console.log('Deal missing positionId:', JSON.stringify(deal));
        continue;
      }

      if (!tradesByPosition.has(posId)) {
        tradesByPosition.set(posId, {});
      }

      const position = tradesByPosition.get(posId)!;
      if (deal.entryType === 'DEAL_ENTRY_IN') {
        position.entry = deal;
        entryCount++;
      } else if (deal.entryType === 'DEAL_ENTRY_OUT') {
        position.exit = deal;
        exitCount++;
      } else {
        otherCount++;
        console.log(`Deal with entryType '${deal.entryType}':`, JSON.stringify(deal));
      }
    }

    console.log(`Deal types: ${entryCount} entries, ${exitCount} exits, ${otherCount} other`);
    console.log(`Grouped into ${tradesByPosition.size} unique positions`);

    const trades: RawTrade[] = [];
    for (const [positionId, { entry, exit }] of tradesByPosition) {
      if (!entry) {
        console.log(`Position ${positionId} has no entry deal, skipping`);
        continue;
      }

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
          ? this.calculateDuration(
              new Date(entry.time).toISOString(),
              new Date(exit.time).toISOString()
            )
          : undefined,
        raw_json: { entry, exit },
      });
    }

    console.log(`Converted to ${trades.length} trades (${trades.filter(t => t.close_time).length} closed, ${trades.filter(t => !t.close_time).length} open)`);
    return trades;
  }
}