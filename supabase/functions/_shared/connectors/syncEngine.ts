import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { BrokerConnection, SyncMode, SyncResult, IBrokerConnector } from './types.ts';
import { MetaApiConnector } from './metatrader/metaapiConnector.ts';
import { normalizeTradesBatch } from './utils/normalizeTrade.ts';
import { upsertTrades, updateConnectionStats } from './utils/upsertTrades.ts';

export class SyncEngine {
  private supabase: SupabaseClient;
  private metaapiToken: string;

  constructor(supabase: SupabaseClient, metaapiToken: string) {
    this.supabase = supabase;
    this.metaapiToken = metaapiToken;
  }

  async syncConnection(
    connectionId: string,
    mode: SyncMode = 'incremental'
  ): Promise<SyncResult> {
    const startTime = new Date().toISOString();

    try {
      const connection = await this.loadConnection(connectionId);

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      if (!connection.is_auto_sync_enabled) {
        return {
          success: false,
          trades_synced: 0,
          error: 'Auto-sync is disabled for this connection',
          timestamp: startTime,
        };
      }

      const connector = this.getConnector(connection);

      const rawTrades =
        mode === 'backfill'
          ? await this.performBackfill(connector, connection)
          : await connector.incrementalSync(connection);

      const normalizedTrades = normalizeTradesBatch(rawTrades, connection);

      const { inserted, updated, errors } = await upsertTrades(
        this.supabase,
        normalizedTrades
      );

      const totalSynced = inserted + updated;

      await updateConnectionStats(this.supabase, connectionId, {
        trades_synced: totalSynced,
        success: true,
      });

      if (errors.length > 0) {
        console.warn(`Sync completed with ${errors.length} errors:`, errors);
      }

      return {
        success: true,
        trades_synced: totalSynced,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const isTemporaryError = errorMessage.includes('SSL certificate error') ||
        errorMessage.includes('invalid peer certificate') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout');

      await updateConnectionStats(this.supabase, connectionId, {
        success: false,
        error: isTemporaryError ? `Temporary connection issue: ${errorMessage}` : errorMessage,
      });

      return {
        success: false,
        trades_synced: 0,
        error: errorMessage,
        timestamp: startTime,
      };
    }
  }

  async syncAllConnections(): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: SyncResult[];
  }> {
    const { data: connections, error } = await this.supabase
      .from('user_broker_connections')
      .select('id')
      .eq('status', 'connected')
      .eq('is_auto_sync_enabled', true);

    if (error || !connections) {
      throw new Error(`Failed to fetch connections: ${error?.message}`);
    }

    const results: SyncResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const connection of connections) {
      const result = await this.syncConnection(connection.id, 'incremental');
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: connections.length,
      successful,
      failed,
      results,
    };
  }

  private async loadConnection(connectionId: string): Promise<BrokerConnection | null> {
    const { data, error } = await this.supabase
      .from('user_broker_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load connection: ${error.message}`);
    }

    return data;
  }

  private getConnector(connection: BrokerConnection): IBrokerConnector {
    if (connection.broker === 'metatrader' && connection.auth_type === 'metaapi') {
      const region = connection.metaapi_region || 'new-york';
      return new MetaApiConnector(this.metaapiToken, region);
    }

    throw new Error(
      `Unsupported broker/auth combination: ${connection.broker}/${connection.auth_type}`
    );
  }

  private async performBackfill(
    connector: IBrokerConnector,
    connection: BrokerConnection
  ): Promise<any[]> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 2);

    return await connector.backfill(connection, fromDate, toDate);
  }
}