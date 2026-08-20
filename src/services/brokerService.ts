import { supabase } from '../lib/supabase';

export interface BrokerFromAPI {
  id: string;
  name: string;
  display_name?: string;
  supported: boolean;
  logo_url?: string;
}

export interface BrokerConnection {
  id: string;
  account_name: string;
  account_type?: string;
  status: 'connected' | 'error' | 'disconnected' | 'connecting';
  last_synced_at?: string;
  trades_count: number;
  created_at: string;
  metaapi_account_id?: string;
  is_auto_sync_enabled?: boolean;
  starting_balance?: number;
  current_balance?: number;
  currency?: string;
  ownership_type?: 'personal' | 'funded' | 'prop';
  last_balance_update?: string;
  broker_type?: string;
  brokers?: { name: string } | null;
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
