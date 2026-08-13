import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { NormalizedTrade } from '../types.ts';

export async function upsertTrades(
  supabase: SupabaseClient,
  trades: NormalizedTrade[]
): Promise<{ inserted: number; updated: number; errors: any[] }> {
  if (trades.length === 0) {
    return { inserted: 0, updated: 0, errors: [] };
  }

  const errors: any[] = [];
  let inserted = 0;
  let updated = 0;

  for (const trade of trades) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', trade.user_id)
        .eq('broker_connection_id', trade.broker_connection_id)
        .eq('broker_trade_id', trade.broker_trade_id)
        .maybeSingle();

      if (fetchError) {
        errors.push({ trade: trade.external_trade_id, error: fetchError.message });
        continue;
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            symbol: trade.symbol,
            side: trade.side,
            entry_time: trade.entry_time,
            exit_time: trade.exit_time,
            duration_seconds: trade.duration_seconds,
            quantity: trade.quantity,
            entry_price: trade.entry_price,
            exit_price: trade.exit_price,
            profit: trade.profit,
            commission: trade.commission,
            swap: trade.swap,
            asset_class: trade.asset_class,
            raw_broker_payload: trade.raw_broker_payload,
          })
          .eq('id', existing.id);

        if (updateError) {
          errors.push({ trade: trade.external_trade_id, error: updateError.message });
        } else {
          updated++;
        }
      } else {
        const { error: insertError } = await supabase
          .from('trades')
          .insert({
            user_id: trade.user_id,
            broker_connection_id: trade.broker_connection_id,
            broker_trade_id: trade.broker_trade_id,
            symbol: trade.symbol,
            side: trade.side,
            entry_time: trade.entry_time,
            exit_time: trade.exit_time,
            duration_seconds: trade.duration_seconds,
            quantity: trade.quantity,
            entry_price: trade.entry_price,
            exit_price: trade.exit_price,
            profit: trade.profit,
            commission: trade.commission,
            swap: trade.swap,
            asset_class: trade.asset_class,
            raw_broker_payload: trade.raw_broker_payload,
          });

        if (insertError) {
          errors.push({ trade: trade.external_trade_id, error: insertError.message });
        } else {
          inserted++;
        }
      }
    } catch (error) {
      errors.push({ trade: trade.external_trade_id, error: String(error) });
    }
  }

  return { inserted, updated, errors };
}

export async function updateConnectionStats(
  supabase: SupabaseClient,
  connectionId: string,
  stats: {
    trades_synced?: number;
    cursor?: string;
    success: boolean;
    error?: string;
  }
): Promise<void> {
  const updates: any = {
    last_synced_at: new Date().toISOString(),
  };

  if (stats.success) {
    updates.last_success_at = new Date().toISOString();
    updates.status = 'connected';
    updates.last_error = null;

    if (stats.cursor) {
      updates.last_cursor = stats.cursor;
    }

    if (stats.trades_synced !== undefined && stats.trades_synced > 0) {
      const { data: connection } = await supabase
        .from('user_broker_connections')
        .select('trades_count')
        .eq('id', connectionId)
        .maybeSingle();

      if (connection) {
        updates.trades_count = (connection.trades_count || 0) + stats.trades_synced;
      }
    }
  } else {
    updates.status = 'error';
    updates.last_error = stats.error || 'Unknown error';
  }

  await supabase
    .from('user_broker_connections')
    .update(updates)
    .eq('id', connectionId);
}