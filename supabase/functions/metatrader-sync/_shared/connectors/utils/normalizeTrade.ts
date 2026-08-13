import type { BrokerConnection, RawTrade, NormalizedTrade, BrokerType } from '../types.ts';

export function normalizeTrade(rawTrade: RawTrade, connection: BrokerConnection): NormalizedTrade {
  const duration = rawTrade.duration_seconds ??
    (rawTrade.close_time ? calculateDuration(rawTrade.open_time, rawTrade.close_time) : undefined);

  return {
    user_id: connection.user_id,
    broker: connection.broker as BrokerType,
    connection_id: connection.id,
    external_trade_id: rawTrade.external_trade_id,
    broker_trade_id: rawTrade.external_trade_id,
    account_id: rawTrade.account_id || connection.account_id,
    account_name: rawTrade.account_name || connection.account_name,
    symbol: rawTrade.symbol,
    side: normalizeSide(rawTrade.side),
    entry_time: rawTrade.open_time,
    exit_time: rawTrade.close_time,
    duration_seconds: duration,
    quantity: rawTrade.quantity || rawTrade.lots,
    entry_price: rawTrade.entry_price,
    exit_price: rawTrade.exit_price,
    profit: rawTrade.pnl || 0,
    commission: rawTrade.commission || rawTrade.fees,
    swap: rawTrade.swap,
    asset_class: determineAssetClass(rawTrade.symbol),
    raw_broker_payload: rawTrade.raw_json,
    broker_connection_id: connection.id,
  };
}

function normalizeSide(side: string): 'buy' | 'sell' | 'long' | 'short' {
  const normalized = side.toLowerCase();
  if (['buy', 'long'].includes(normalized)) return 'buy';
  if (['sell', 'short'].includes(normalized)) return 'sell';
  return normalized as any;
}

function calculateDuration(openTime: string, closeTime: string): number {
  const open = new Date(openTime).getTime();
  const close = new Date(closeTime).getTime();
  return Math.floor((close - open) / 1000);
}

function determineAssetClass(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes('USD') || upper.includes('EUR') || upper.includes('GBP') ||
      upper.includes('JPY') || upper.includes('CHF') || upper.includes('CAD') ||
      upper.includes('AUD') || upper.includes('NZD')) {
    return 'forex';
  }
  if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('USDT')) {
    return 'crypto';
  }
  if (upper.includes('ES') || upper.includes('NQ') || upper.includes('YM') ||
      upper.includes('CL') || upper.includes('GC')) {
    return 'futures';
  }
  return 'stock';
}

export function normalizeTradesBatch(rawTrades: RawTrade[], connection: BrokerConnection): NormalizedTrade[] {
  return rawTrades.map(trade => normalizeTrade(trade, connection));
}