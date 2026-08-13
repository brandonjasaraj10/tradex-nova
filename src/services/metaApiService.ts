import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ConnectResult {
  success: boolean;
  connectionId?: string;
  metaapiAccountId?: string;
  tradesImported?: number;
  error?: string;
}

export class MetaApiService {
  private static instance: MetaApiService;

  private constructor() {}

  static getInstance(): MetaApiService {
    if (!MetaApiService.instance) {
      MetaApiService.instance = new MetaApiService();
    }
    return MetaApiService.instance;
  }

  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }
    return session.access_token;
  }

  private async callEdgeFunction(endpoint: string, body?: object): Promise<any> {
    const token = await this.getAuthToken();
    const url = `${SUPABASE_URL}/functions/v1/metatrader-sync${endpoint}`;

    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || `HTTP ${response.status}`);
    }

    return data;
  }

  async connectMetaTrader(params: {
    brokerId?: string;
    accountName: string;
    platform: 'mt4' | 'mt5';
    server: string;
    login: string;
    password: string;
  }): Promise<ConnectResult> {
    try {
      console.log('[MetaAPI] Connecting via edge function...');

      const result = await this.callEdgeFunction('/connect', {
        broker_id: params.brokerId,
        account_name: params.accountName,
        platform: params.platform,
        server: params.server,
        login: params.login,
        password: params.password,
      });

      console.log('[MetaAPI] Connection result:', result);

      return {
        success: result.success !== false,
        connectionId: result.connection_id,
        metaapiAccountId: result.metaapi_account_id,
        tradesImported: result.trades_imported || 0,
      };
    } catch (error) {
      console.error('[MetaAPI] Connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncTrades(connectionId: string): Promise<number> {
    console.log(`[MetaAPI] Syncing trades for connection ${connectionId}...`);

    const result = await this.callEdgeFunction('/sync', {
      connection_id: connectionId,
      mode: 'incremental',
      enable_audit: false,
    });

    console.log('[MetaAPI] Sync result:', result);

    return result.trades_synced || 0;
  }

  async diagnoseConnection(connectionId: string): Promise<any> {
    console.log(`[MetaAPI] Diagnosing connection ${connectionId}...`);

    const result = await this.callEdgeFunction('/diagnose', {
      connection_id: connectionId,
    });

    return result;
  }

  async getAccountStatus(connectionId: string): Promise<{ status: string; connectionStatus?: string }> {
    try {
      const result = await this.diagnoseConnection(connectionId);
      return {
        status: result.metaapi_account?.state || 'unknown',
        connectionStatus: result.metaapi_account?.connectionStatus,
      };
    } catch (error) {
      console.error('[MetaAPI] Status check error:', error);
      return { status: 'error' };
    }
  }
}

export const metaApiService = MetaApiService.getInstance();
