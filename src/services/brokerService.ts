import { supabase } from '../lib/supabase';

export interface BrokerFromAPI {
  id: string;
  name: string;
  slug: string;
  category: string;
  supports_auto_sync: boolean;
  supports_file_upload: boolean;
  status: 'live' | 'coming_soon';
  logo_url?: string;
}

export interface BrokerConnection {
  id: string;
  account_name: string;
  account_type?: string;
  connection_type: string;
  status: 'connected' | 'error' | 'disconnected' | 'connecting';
  last_synced_at?: string;
  last_error?: string;
  trades_count: number;
  created_at: string;
  username?: string;
  server?: string;
  webhook_secret?: string;
  webhook_url?: string;
  platform?: string;
  metaapi_account_id?: string;
  is_auto_sync_enabled?: boolean;
  starting_balance?: number;
  current_balance?: number;
  currency?: string;
  ownership_type?: 'personal' | 'funded' | 'prop';
  last_balance_update?: string;
  brokers?: BrokerFromAPI | null;
}

export interface ConnectBrokerParams {
  broker_slug: string;
  broker_id?: string;
  account_name: string;
  account_type?: string;
  connection_type: 'api_key' | 'oauth' | 'credentials';
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
  username?: string;
  password?: string;
  server?: string;
  starting_balance: number;
  currency?: string;
  ownership_type?: 'personal' | 'funded' | 'prop';
}

export interface SyncResult {
  success: boolean;
  tradesImported: number;
  tradesUpdated: number;
  error?: string;
}

export class BrokerService {
  private static instance: BrokerService;
  private apiUrl: string;

  private constructor() {
    this.apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/broker-api`;
  }

  static getInstance(): BrokerService {
    if (!BrokerService.instance) {
      BrokerService.instance = new BrokerService();
    }
    return BrokerService.instance;
  }

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async getAvailableBrokers(): Promise<BrokerFromAPI[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/list`, { headers });
      const data = await response.json();
      return data.brokers || [];
    } catch (error) {
      console.error('Error fetching brokers:', error);
      return [];
    }
  }

  async getUserConnections(): Promise<BrokerConnection[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/connections`, { headers });
      const data = await response.json();
      return data.connections || [];
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  async connectBroker(params: ConnectBrokerParams): Promise<{ success: boolean; connection?: BrokerConnection; error?: string }> {
    try {
      console.log('🌐 Broker Service: Connecting broker...', params.broker_slug);
      console.log('📤 Request params:', { ...params, password: params.password ? '***' : undefined });

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📥 Response data:', data);

      if (!response.ok) {
        console.error('❌ API returned error:', data.error);
        return { success: false, error: data.error || 'Failed to connect' };
      }

      return { success: data.valid, connection: data.connection };
    } catch (error) {
      console.error('❌ Error connecting broker:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(connectionId: string): Promise<{ status: string; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connection_id: connectionId }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error testing connection:', error);
      return { status: 'error', message: 'Failed to test connection' };
    }
  }

  async syncConnection(connectionId: string, enableAudit: boolean = false): Promise<SyncResult & { audit?: any }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connection_id: connectionId }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error syncing connection:', error);
      return {
        success: false,
        tradesImported: 0,
        tradesUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnectBroker(connectionId: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiUrl}/disconnect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connection_id: connectionId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to disconnect');
      return data.success === true;
    } catch (error) {
      console.error('Error disconnecting broker:', error);
      return false;
    }
  }

  async toggleAutoSync(connectionId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_broker_connections')
        .update({ is_auto_sync_enabled: enabled })
        .eq('id', connectionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling auto-sync:', error);
      return false;
    }
  }
}

export const brokerService = BrokerService.getInstance();
