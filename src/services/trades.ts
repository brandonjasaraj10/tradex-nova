import { supabase } from '../lib/supabase';
import type { Trade, TradeFormData, TradeStats, TradeFilters } from '../types/trade';
import { toLocalDateStr } from '../utils/dateHelpers';

export async function createTrade(data: TradeFormData): Promise<Trade> {
  const user = supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const pnl = calculatePnL(data);

  const { data: trade, error } = await supabase
    .from('trades')
    .insert({
      ...data,
      user_id: (await user).data.user?.id,
      pnl,
    })
    .select()
    .single();

  if (error) throw error;
  return trade;
}

export async function updateTrade(id: string, data: Partial<TradeFormData>): Promise<Trade> {
  const { data: trade, error } = await supabase
    .from('trades')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return trade;
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getTrades(filters?: TradeFilters, accountId?: string): Promise<Trade[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false });

  if (accountId) {
    query = query.eq('broker_id', accountId);
  }

  if (filters) {
    if (filters.dateRange) {
      query = query
        .gte('entry_date', filters.dateRange[0].toISOString())
        .lte('entry_date', filters.dateRange[1].toISOString());
    }
    if (filters.symbols?.length) {
      query = query.in('symbol', filters.symbols);
    }
    if (filters.setups?.length) {
      query = query.in('setup', filters.setups);
    }
    if (filters.tags?.length) {
      query = query.contains('tags', filters.tags);
    }
    if (filters.direction) {
      query = query.eq('direction', filters.direction);
    }
    if (filters.timeframe) {
      query = query.eq('timeframe', filters.timeframe);
    }
    if (filters.pnlRange) {
      query = query
        .gte('pnl', filters.pnlRange[0])
        .lte('pnl', filters.pnlRange[1]);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getRecentTrades(limit: number = 10): Promise<Trade[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recent trades:', error);
    return [];
  }
}

interface UnifiedTrade {
  pnl: number;
  symbol: string;
  direction: string;
  entry_date: string;
  exit_date?: string;
  created_at: string;
  source: 'trades' | 'journal';
}

async function getAllUnifiedTrades(
  userId: string,
  dateRange?: [Date, Date],
  accountId?: string
): Promise<UnifiedTrade[]> {
  let tradesQuery = supabase
    .from('trades')
    .select('pnl, symbol, direction, entry_date, exit_date, created_at, broker_id')
    .eq('user_id', userId);

  if (dateRange) {
    tradesQuery = tradesQuery
      .gte('entry_date', dateRange[0].toISOString())
      .lte('entry_date', dateRange[1].toISOString());
  }
  if (accountId) {
    tradesQuery = tradesQuery.eq('broker_id', accountId);
  }

  let journalQuery = supabase
    .from('journal_entries')
    .select('id, manual_pnl, symbol, direction, entry_date, created_at')
    .eq('user_id', userId)
    .not('manual_pnl', 'is', null);

  if (dateRange) {
    journalQuery = journalQuery
      .gte('entry_date', toLocalDateStr(dateRange[0]))
      .lte('entry_date', toLocalDateStr(dateRange[1]));
  }
  // journal_entries carries its own account_id, so journal-logged P&L
  // scopes to the selected account exactly like trades do. Leaving this
  // unfiltered meant a single-account view still summed every other
  // account's journal P&L.
  if (accountId) {
    journalQuery = journalQuery.eq('account_id', accountId);
  }

  const [tradesResult, journalResult] = await Promise.all([
    tradesQuery,
    journalQuery,
  ]);

  if (tradesResult.error) throw tradesResult.error;
  if (journalResult.error) throw journalResult.error;

  const tradesData: UnifiedTrade[] = (tradesResult.data || []).map((t: any) => ({
    pnl: t.pnl || 0,
    symbol: t.symbol || '',
    direction: t.direction || 'LONG',
    entry_date: t.entry_date,
    exit_date: t.exit_date,
    created_at: t.created_at,
    source: 'trades' as const,
  }));

  const journalData: UnifiedTrade[] = (journalResult.data || [])
    .map((e: any) => ({
      pnl: e.manual_pnl ?? 0,
      symbol: e.symbol || '',
      direction: e.direction || 'LONG',
      entry_date: e.entry_date,
      exit_date: e.entry_date,
      created_at: e.created_at,
      source: 'journal' as const,
    }));

  return [...tradesData, ...journalData];
}

export async function getTradeStats(dateRange?: [Date, Date], accountId?: string): Promise<TradeStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const allTrades = await getAllUnifiedTrades(user.id, dateRange, accountId);

  const winningTrades = allTrades.filter(t => t.pnl > 0);
  const losingTrades = allTrades.filter(t => t.pnl <= 0);

  return {
    total_trades: allTrades.length,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length,
    win_rate: allTrades.length > 0 ? (winningTrades.length / allTrades.length) * 100 : 0,
    total_pnl: allTrades.reduce((sum, t) => sum + t.pnl, 0),
    average_win: winningTrades.length ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0,
    average_loss: losingTrades.length ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0,
    largest_win: winningTrades.length ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
    largest_loss: losingTrades.length ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
    profit_factor: losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) === 0 ?
      Infinity :
      winningTrades.reduce((sum, t) => sum + t.pnl, 0) / Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)),
    total_lots: 0
  };
}

export async function getTradesForCharts(dateRange?: [Date, Date], accountId?: string): Promise<UnifiedTrade[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return getAllUnifiedTrades(user.id, dateRange, accountId);
}

export async function getDailyPnL(
  year: number,
  month: number,
  accountId?: string
): Promise<Map<number, { pnl: number; trades: number; hasJournal: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Map();

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const startStr = toLocalDateStr(startDate);
  const endStr = toLocalDateStr(endDate);

  const allTrades = await getAllUnifiedTrades(
    user.id,
    [startDate, endDate],
    accountId
  );

  const dailyMap = new Map<number, { pnl: number; trades: number; hasJournal: boolean }>();

  for (const trade of allTrades) {
    // entry_date is a full UTC timestamp for real trades but an
    // already-local plain date for journal-sourced entries (entry_date is
    // a `date` column there, never stored with a time/offset) - only the
    // timestamp case needs converting to a local calendar day, otherwise
    // that conversion would wrongly shift the already-correct plain date.
    const dateStr = !trade.entry_date
      ? ''
      : trade.entry_date.includes('T')
        ? toLocalDateStr(new Date(trade.entry_date))
        : trade.entry_date;
    if (dateStr < startStr || dateStr > endStr) continue;
    const day = parseInt(dateStr.split('-')[2], 10);
    const existing = dailyMap.get(day) || { pnl: 0, trades: 0, hasJournal: false };
    existing.pnl += trade.pnl;
    existing.trades += 1;
    dailyMap.set(day, existing);
  }

  // A journal entry (text/screenshots, no manual P&L attached) doesn't show up
  // in getAllUnifiedTrades above - that only counts entries with a manual_pnl
  // set. Without this, a day with real journal content but no trade/P&L was
  // completely invisible on the calendar - no indicator, and clicking it did
  // nothing since it was treated as empty.
  let journalDayQuery = supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', user.id)
    .gte('entry_date', startStr)
    .lte('entry_date', endStr);

  if (accountId) {
    journalDayQuery = journalDayQuery.eq('account_id', accountId);
  }

  const { data: journalEntries, error: journalError } = await journalDayQuery;

  if (!journalError && journalEntries) {
    for (const entry of journalEntries) {
      const day = parseInt(entry.entry_date.split('-')[2], 10);
      const existing = dailyMap.get(day);
      if (existing) {
        existing.hasJournal = true;
      } else {
        dailyMap.set(day, { pnl: 0, trades: 0, hasJournal: true });
      }
    }
  }

  return dailyMap;
}

export function calculatePnL(data: TradeFormData): number {
  const { direction, entry_price, exit_price, quantity } = data;
  return direction === 'LONG'
    ? (exit_price - entry_price) * quantity
    : (entry_price - exit_price) * quantity;
}

/*
  One row per position, from both places a trade can live.

  A trade reaches TradeX two ways: imported or entered into the `trades`
  table, or written into a journal entry with a manual P&L. Reading only
  `trades` is the mistake this codebase has made three separate times -
  Recent Activity, the NOVA Score and the weekly reports each shipped
  showing one source and looking perfectly correct while omitting the other.
  On the standing test data one account holds 14 rows in `trades` and 6
  journal-logged trades, so a trades-only log would show 14 and read as
  complete.

  getAllUnifiedTrades above already merges the two for charts, but it drops
  the row id and every field except P&L, symbol, direction and dates - fine
  for summing, not enough to list. This selects what a log needs and keeps
  the id, so a row can link back to whatever it came from.
*/
export interface TradeLogRow {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  pnl: number;
  entry_date: string;
  exit_date: string | null;
  notes: string;
  tags: string[];
  setup: string | null;
  source: 'trades' | 'journal';
}

export async function getTradeLog(
  dateRange?: [Date, Date],
  accountId?: string
): Promise<TradeLogRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let tradesQuery = supabase
    .from('trades')
    .select('id, symbol, direction, entry_price, exit_price, quantity, pnl, entry_date, exit_date, notes, tags, setup')
    .eq('user_id', user.id);

  if (dateRange) {
    tradesQuery = tradesQuery
      .gte('entry_date', dateRange[0].toISOString())
      .lte('entry_date', dateRange[1].toISOString());
  }
  if (accountId) {
    tradesQuery = tradesQuery.eq('broker_id', accountId);
  }

  let journalQuery = supabase
    .from('journal_entries')
    .select('id, title, symbol, direction, manual_pnl, position_size, entry_date, content, tags')
    .eq('user_id', user.id)
    .not('manual_pnl', 'is', null);

  if (dateRange) {
    // journal_entries.entry_date is a DATE, not a timestamp - comparing it
    // against an ISO string is what put evening trades in the wrong day
    // elsewhere in this file.
    journalQuery = journalQuery
      .gte('entry_date', toLocalDateStr(dateRange[0]))
      .lte('entry_date', toLocalDateStr(dateRange[1]));
  }
  if (accountId) {
    journalQuery = journalQuery.eq('account_id', accountId);
  }

  const [tradesResult, journalResult] = await Promise.all([tradesQuery, journalQuery]);
  if (tradesResult.error) throw tradesResult.error;
  if (journalResult.error) throw journalResult.error;

  const fromTrades: TradeLogRow[] = (tradesResult.data || []).map((t: any) => ({
    id: t.id,
    symbol: t.symbol || '',
    direction: t.direction || '',
    entry_price: t.entry_price ?? null,
    exit_price: t.exit_price ?? null,
    quantity: t.quantity ?? null,
    pnl: Number(t.pnl) || 0,
    entry_date: t.entry_date,
    exit_date: t.exit_date ?? null,
    notes: t.notes || '',
    tags: t.tags || [],
    setup: t.setup ?? null,
    source: 'trades',
  }));

  const fromJournal: TradeLogRow[] = (journalResult.data || []).map((e: any) => ({
    id: e.id,
    symbol: e.symbol || '',
    direction: e.direction || '',
    // A journal entry records what happened, not the ladder of prices, so
    // these are genuinely unknown rather than zero. Showing 0.00 would be
    // inventing a fill price the trader never gave us.
    entry_price: null,
    exit_price: null,
    quantity: null,
    pnl: Number(e.manual_pnl) || 0,
    entry_date: e.entry_date,
    exit_date: null,
    // Strip tags from the stored HTML so search matches what the user wrote
    // rather than the markup around it.
    notes: (e.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    tags: e.tags || [],
    setup: e.position_size ?? null,
    source: 'journal',
  }));

  return [...fromTrades, ...fromJournal].sort(
    (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
  );
}
