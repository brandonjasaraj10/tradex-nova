export type BrokerType = 
  // Stock Brokers
  | 'td_ameritrade'
  | 'thinkorswim'
  | 'interactive_brokers'
  | 'robinhood'
  | 'etrade'
  | 'charles_schwab'
  | 'fidelity'
  | 'webull'
  | 'tradestation'
  | 'tastytrade'
  | 'ally_invest'
  | 'merrill_edge'
  | 'zacks_trade'
  | 'moomoo'
  | 'public'
  | 'sofi'
  
  // Futures Brokers
  | 'ninjatrader'
  | 'tradovate'
  | 'amp_futures'
  | 'rithmic'
  | 'cqg'
  | 'edgeclear'
  | 'phillip_capital'
  | 'ironbeam'
  | 'sierra_chart'
  
  // Forex Brokers
  | 'oanda'
  | 'forex_com'
  | 'ig'
  | 'fxcm'
  | 'pepperstone'
  | 'ic_markets'
  | 'eightcap'
  | 'xm'
  | 'hugosway'
  | 'exness'
  
  // Crypto Exchanges
  | 'binance'
  | 'coinbase_pro'
  | 'kraken'
  | 'bybit'
  | 'bitget'
  | 'bitmex'
  | 'deribit'
  | 'kucoin'
  | 'okx'
  | 'crypto_com'
  | 'gemini'
  | 'binance_us'
  | 'phemex';

export interface BrokerCredentials {
  accountNumber: string;
  investorPassword: string;
}

export interface Broker {
  id: string;
  name: string;
  type: BrokerType;
  category: 'stocks' | 'futures' | 'forex' | 'crypto';
  credentials: BrokerCredentials;
  isConnected: boolean;
  features: string[];
  description: string;
  requiredFields: (keyof BrokerCredentials)[];
}

export interface Trade {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  direction: 'LONG' | 'SHORT';
  entryDate: Date;
  exitDate: Date;
  pnl: number;
  fees: number;
  broker: string;
  asset_class?: 'stocks' | 'futures' | 'forex' | 'crypto' | 'options';
  exchange?: string;
  commission?: number;
  slippage?: number;
  execution_time?: number;
  strategy?: string;
  risk_reward?: number;
  screenshot_url?: string;
  notes?: string;
}