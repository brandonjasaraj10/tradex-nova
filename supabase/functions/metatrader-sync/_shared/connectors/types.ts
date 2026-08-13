export type BrokerType = 'metatrader' | 'ctrader' | 'tradelocker' | 'tradovate' | 'ninjatrader';

export type AuthType = 'metaapi' | 'oauth' | 'api_key' | 'bridge' | 'username_password';

export type SyncMode = 'backfill' | 'incremental';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface BrokerConnection {
  id: string;
  user_id: string;
  broker: BrokerType;
  broker_id?: string;
  account_name: string;
  auth_type: AuthType;
  platform?: string;
  connection_type?: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  username?: string;
  password?: string;
  server?: string;
  account_id?: string;
  external_account_id?: string;
  metaapi_account_id?: string;
  metaapi_region?: string;
  webhook_secret?: string;
  settings_json?: Record<string, any>;
  account_type?: string;
  status: ConnectionStatus;
  is_auto_sync_enabled?: boolean;
  last_synced_at?: string;
  last_success_at?: string;
  last_error?: string;
  last_cursor?: string;
  trades_count?: number;
  sync_method?: 'polling' | 'streaming';
  created_at: string;
  updated_at: string;
}

export interface RawTrade {
  external_trade_id: string;
  account_id?: string;
  account_name?: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  open_time: string;
  close_time?: string;
  quantity?: number;
  lots?: number;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  pnl_currency?: string;
  commission?: number;
  fees?: number;
  swap?: number;
  duration_seconds?: number;
  raw_json: Record<string, any>;
}

export interface NormalizedTrade {
  user_id: string;
  broker: BrokerType;
  connection_id: string;
  external_trade_id: string;
  broker_trade_id: string;
  account_id?: string;
  account_name?: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  entry_time: string;
  exit_time?: string;
  duration_seconds?: number;
  quantity?: number;
  entry_price: number;
  exit_price?: number;
  profit: number;
  commission?: number;
  swap?: number;
  asset_class?: string;
  raw_broker_payload: Record<string, any>;
  broker_connection_id: string;
}

export interface SyncAudit {
  mode: SyncMode;
  time_window: { from: string; to: string; };
  raw_count: number;
  normalized_count: number;
  upserted_count: number;
  sample_raw: any[];
  sample_normalized: any[];
  dedupe_conflicts: number;
  dropped_records: Array<{ stage: 'normalization' | 'upsert'; reason: string; sample?: any; }>;
}

export interface SyncResult {
  success: boolean;
  trades_synced: number;
  cursor?: string;
  error?: string;
  timestamp: string;
  audit?: SyncAudit;
}

export interface ConnectPayload {
  user_id: string;
  broker: BrokerType;
  auth_type: AuthType;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}

export interface HealthCheckResult {
  status: ConnectionStatus;
  message?: string;
  last_activity?: string;
}

export interface IBrokerConnector {
  connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>>;
  disconnect(connectionId: string): Promise<void>;
  backfill(connection: BrokerConnection, fromDate: Date, toDate: Date): Promise<RawTrade[]>;
  incrementalSync(connection: BrokerConnection): Promise<RawTrade[]>;
  healthCheck(connection: BrokerConnection): Promise<HealthCheckResult>;
}