export interface Trade {
  id: string;
  user_id: string;
  broker_connection_id?: string;
  symbol: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  direction: 'LONG' | 'SHORT';
  entry_date: string;
  exit_date: string;
  pnl: number;
  fees: number;
  notes?: string;
  tags: string[];
  setup?: string;
  timeframe?: string;
  screenshot_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TradeFormData {
  symbol: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  direction: 'LONG' | 'SHORT';
  entry_date: Date;
  exit_date: Date;
  fees: number;
  notes?: string;
  tags: string[];
  setup?: string;
  timeframe?: string;
  screenshot_url?: string;
}

export interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  profit_factor: number;
  total_lots: number;
}

export interface TradeFilters {
  dateRange?: [Date, Date];
  symbols?: string[];
  setups?: string[];
  tags?: string[];
  direction?: 'LONG' | 'SHORT';
  timeframe?: string;
  pnlRange?: [number, number];
}