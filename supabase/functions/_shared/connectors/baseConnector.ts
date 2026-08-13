import type {
  BrokerConnection,
  RawTrade,
  SyncResult,
  ConnectPayload,
  HealthCheckResult,
  SyncMode,
} from './types.ts';

export interface IBrokerConnector {
  connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>>;

  disconnect(connectionId: string): Promise<void>;

  backfill(
    connection: BrokerConnection,
    fromDate: Date,
    toDate: Date
  ): Promise<RawTrade[]>;

  incrementalSync(connection: BrokerConnection): Promise<RawTrade[]>;

  healthCheck(connection: BrokerConnection): Promise<HealthCheckResult>;
}

export abstract class BaseBrokerConnector implements IBrokerConnector {
  abstract connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>>;

  abstract disconnect(connectionId: string): Promise<void>;

  abstract backfill(
    connection: BrokerConnection,
    fromDate: Date,
    toDate: Date
  ): Promise<RawTrade[]>;

  abstract incrementalSync(connection: BrokerConnection): Promise<RawTrade[]>;

  abstract healthCheck(connection: BrokerConnection): Promise<HealthCheckResult>;

  protected formatDate(date: Date): string {
    return date.toISOString();
  }

  protected calculateDuration(openTime: string, closeTime?: string): number | undefined {
    if (!closeTime) return undefined;

    const open = new Date(openTime).getTime();
    const close = new Date(closeTime).getTime();
    return Math.floor((close - open) / 1000);
  }

  protected normalizeSide(side: string): 'buy' | 'sell' | 'long' | 'short' {
    const normalized = side.toLowerCase();
    if (['buy', 'long'].includes(normalized)) return 'buy';
    if (['sell', 'short'].includes(normalized)) return 'sell';
    return normalized as any;
  }
}