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
    mode: SyncMode = 'incremental',
    enableAudit: boolean = false
  ): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    console.log(`[SYNC] Starting sync for connection ${connectionId}, mode: ${mode}`);

    try {
      const connection = await this.loadConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      if (!connection.is_auto_sync_enabled) {
        return { success: false, trades_synced: 0, error: 'Auto-sync is disabled', timestamp: startTime };
      }

      const connector = this.getConnector(connection);
      const fromDate = mode === 'backfill'
        ? (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })()
        : new Date(connection.last_success_at || connection.last_synced_at || new Date(Date.now() - 24 * 60 * 60 * 1000));
      const toDate = new Date();

      const rawTrades = mode === 'backfill'
        ? await connector.backfill(connection, fromDate, toDate)
        : await connector.incrementalSync(connection);

      console.log(`[SYNC] Raw trades fetched: ${rawTrades.length}`);

      const normalizedTrades = normalizeTradesBatch(rawTrades, connection);
      console.log(`[SYNC] Normalized trades: ${normalizedTrades.length}`);

      const { inserted, updated, skipped, errors, dedupe_conflicts } = await upsertTrades(this.supabase, normalizedTrades);
      const totalSynced = inserted + updated;

      console.log(`[SYNC] Upsert: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);

      await updateConnectionStats(this.supabase, connectionId, { trades_synced: totalSynced, success: true });

      const result: SyncResult = { success: true, trades_synced: totalSynced, timestamp: startTime };

      if (enableAudit) {
        result.audit = {
          mode,
          time_window: { from: fromDate.toISOString(), to: toDate.toISOString() },
          raw_count: rawTrades.length,
          normalized_count: normalizedTrades.length,
          upserted_count: totalSynced,
          sample_raw: rawTrades.slice(0, 2),
          sample_normalized: normalizedTrades.slice(0, 2),
          dedupe_conflicts,
          dropped_records: [],
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SYNC] Failed:`, errorMessage);
      await updateConnectionStats(this.supabase, connectionId, { success: false, error: errorMessage });
      return { success: false, trades_synced: 0, error: errorMessage, timestamp: startTime };
    }
  }

  private async loadConnection(connectionId: string): Promise<BrokerConnection | null> {
    const { data, error } = await this.supabase
      .from('user_broker_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load connection: ${error.message}`);
    return data;
  }

  private getConnector(connection: BrokerConnection): IBrokerConnector {
    if (connection.broker === 'metatrader' && connection.auth_type === 'metaapi') {
      return new MetaApiConnector(this.metaapiToken, connection.metaapi_region || 'new-york');
    }
    throw new Error(`Unsupported broker/auth: ${connection.broker}/${connection.auth_type}`);
  }
}