import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../utils/dateHelpers';

export interface TradingReport {
  id: string;
  user_id: string;
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  risk_reward_ratio: number;
  best_trade: number;
  worst_trade: number;
  largest_win_streak: number;
  largest_loss_streak: number;
  most_traded_pairs: Array<{ pair: string; count: number }>;
  session_breakdown: Record<string, { trades: number; pnl: number }>;
  avg_trade_duration: number;
  rule_compliance_rate: number;
  avg_psychology_score: number;
  best_trading_day: string | null;
  worst_trading_day: string | null;
  total_trading_days: number;
  key_insights: Array<{ type: string; message: string }>;
  generated_at: string;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
}

export async function generateReport(
  userId: string,
  reportType: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  periodStart: string,
  periodEnd: string,
  forceRefresh: boolean = false,
  // Omit for "All Accounts"; pass an id to scope the report to one account.
  accountId?: string | null
): Promise<TradingReport> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        user_id: userId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        force_refresh: forceRefresh,
        account_id: accountId ?? null
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate report');
  }

  const result = await response.json();
  return result.report;
}

function mapDbRowToReport(row: any): TradingReport {
  const s = row.summary || {};
  const m = row.metrics || {};
  return {
    id: row.id,
    user_id: row.user_id,
    report_type: row.report_type,
    period_start: row.period_start,
    period_end: row.period_end,
    total_trades: s.total_trades ?? 0,
    winning_trades: s.winning_trades ?? 0,
    losing_trades: s.losing_trades ?? 0,
    win_rate: s.win_rate ?? 0,
    total_pnl: s.total_pnl ?? 0,
    avg_win: s.avg_win ?? 0,
    avg_loss: s.avg_loss ?? 0,
    risk_reward_ratio: s.risk_reward_ratio ?? 0,
    best_trade: s.best_trade ?? 0,
    worst_trade: s.worst_trade ?? 0,
    largest_win_streak: s.largest_win_streak ?? 0,
    largest_loss_streak: s.largest_loss_streak ?? 0,
    best_trading_day: s.best_trading_day ?? null,
    worst_trading_day: s.worst_trading_day ?? null,
    total_trading_days: s.total_trading_days ?? 0,
    most_traded_pairs: m.most_traded_pairs ?? [],
    session_breakdown: m.session_breakdown ?? {},
    avg_trade_duration: m.avg_trade_duration ?? 0,
    rule_compliance_rate: m.rule_compliance_rate ?? 0,
    avg_psychology_score: m.avg_psychology_score ?? 0,
    key_insights: m.key_insights ?? [{ type: 'neutral', message: 'Continue tracking for more insights' }],
    generated_at: s.generated_at ?? row.created_at,
    is_stale: s.is_stale ?? false,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

export async function getReport(
  userId: string,
  reportType: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  periodStart: string
): Promise<TradingReport | null> {
  const { data, error } = await supabase
    .from('trading_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', reportType)
    .eq('period_start', periodStart)
    .maybeSingle();

  if (error) {
    console.error('Error fetching report:', error);
    return null;
  }

  return data ? mapDbRowToReport(data) : null;
}

export async function getWeeklyReports(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TradingReport[]> {
  const { data, error } = await supabase
    .from('trading_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', 'weekly')
    .gte('period_start', startDate)
    .lte('period_start', endDate)
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching weekly reports:', error);
    return [];
  }

  return (data || []).map(mapDbRowToReport);
}

export function getWeekBounds(date: Date): { start: string; end: string } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);

  const weekStart = new Date(date);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    start: toLocalDateStr(weekStart),
    end: toLocalDateStr(weekEnd)
  };
}

export function getMonthBasedWeekBounds(date: Date): { start: string; end: string } {
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  const formatDate = (y: number, m: number, d: number): string => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  let startDay: number;
  let endDay: number;

  // Determine which week the date falls into (1-7, 8-14, 15-21, 22-end)
  if (dayOfMonth >= 1 && dayOfMonth <= 7) {
    startDay = 1;
    endDay = 7;
  } else if (dayOfMonth >= 8 && dayOfMonth <= 14) {
    startDay = 8;
    endDay = 14;
  } else if (dayOfMonth >= 15 && dayOfMonth <= 21) {
    startDay = 15;
    endDay = 21;
  } else {
    // Days 22 to end of month
    startDay = 22;
    endDay = new Date(year, month + 1, 0).getDate();
  }

  return {
    start: formatDate(year, month, startDay),
    end: formatDate(year, month, endDay)
  };
}

export function getMonthWeeks(year: number, month: number): Array<{ start: string; end: string }> {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const weeks: Array<{ start: string; end: string }> = [];

  const formatDate = (y: number, m: number, d: number): string => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // Week 1: 1-7
  weeks.push({
    start: formatDate(year, month, 1),
    end: formatDate(year, month, 7)
  });

  // Week 2: 8-14
  weeks.push({
    start: formatDate(year, month, 8),
    end: formatDate(year, month, 14)
  });

  // Week 3: 15-21
  weeks.push({
    start: formatDate(year, month, 15),
    end: formatDate(year, month, 21)
  });

  // Week 4: 22-end (28, 29, 30, or 31 depending on month)
  weeks.push({
    start: formatDate(year, month, 22),
    end: formatDate(year, month, lastDay)
  });

  return weeks;
}

export function getMonthBounds(date: Date): { start: string; end: string } {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    start: toLocalDateStr(monthStart),
    end: toLocalDateStr(monthEnd)
  };
}

export function getQuarterBounds(date: Date): { start: string; end: string } {
  const quarter = Math.floor(date.getMonth() / 3);
  const quarterStart = new Date(date.getFullYear(), quarter * 3, 1);
  const quarterEnd = new Date(date.getFullYear(), quarter * 3 + 3, 0);

  return {
    start: toLocalDateStr(quarterStart),
    end: toLocalDateStr(quarterEnd)
  };
}

export function getYearBounds(date: Date): { start: string; end: string } {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const yearEnd = new Date(date.getFullYear(), 11, 31);

  return {
    start: toLocalDateStr(yearStart),
    end: toLocalDateStr(yearEnd)
  };
}
