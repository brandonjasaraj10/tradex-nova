import { supabase } from '../lib/supabase';

export interface NOVAScoreBreakdown {
  overall_score: number;
  consistency_score: number;
  risk_management_score: number;
  profitability_score: number;
  discipline_score: number;
  execution_score: number;
  win_rate: number;
  profit_factor: number;
  avg_win_loss_ratio: number;
  total_trades: number;
}

export interface NOVAScore extends NOVAScoreBreakdown {
  id: string;
  user_id: string;
  account_id: string | null;
  calculation_date: string;
  created_at: string;
  updated_at: string;
}

export interface TradeData {
  profit_loss: number;
  entry_time: string;
  exit_time: string;
  risk_reward_ratio?: number;
  confluence_count?: number;
}

export async function calculateNOVAScore(trades: TradeData[]): Promise<NOVAScoreBreakdown> {
  if (trades.length === 0) {
    return {
      overall_score: 0,
      consistency_score: 0,
      risk_management_score: 0,
      profitability_score: 0,
      discipline_score: 0,
      execution_score: 0,
      win_rate: 0,
      profit_factor: 0,
      avg_win_loss_ratio: 0,
      total_trades: 0
    };
  }

  const winningTrades = trades.filter(t => t.profit_loss > 0);
  const losingTrades = trades.filter(t => t.profit_loss < 0);

  const totalWins = winningTrades.length;
  const totalLosses = losingTrades.length;
  const winRate = (totalWins / trades.length) * 100;

  const totalGains = winningTrades.reduce((sum, t) => sum + t.profit_loss, 0);
  const totalLosses_amount = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit_loss, 0));
  const profitFactor = totalLosses_amount > 0 ? totalGains / totalLosses_amount : totalGains > 0 ? 10 : 0;

  const avgWin = totalWins > 0 ? totalGains / totalWins : 0;
  const avgLoss = totalLosses > 0 ? totalLosses_amount / totalLosses : 0;
  const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 10 : 0;

  const profitabilityScore = calculateProfitabilityScore(winRate, profitFactor, avgWinLossRatio);

  const consistencyScore = calculateConsistencyScore(trades);

  const riskManagementScore = calculateRiskManagementScore(trades, avgWinLossRatio);

  const disciplineScore = calculateDisciplineScore(trades);

  const executionScore = calculateExecutionScore(trades, winRate);

  const overallScore = Math.round(
    (profitabilityScore * 0.30) +
    (consistencyScore * 0.25) +
    (riskManagementScore * 0.20) +
    (disciplineScore * 0.15) +
    (executionScore * 0.10)
  );

  return {
    overall_score: Math.min(100, Math.max(0, overallScore)),
    consistency_score: Math.min(100, Math.max(0, Math.round(consistencyScore))),
    risk_management_score: Math.min(100, Math.max(0, Math.round(riskManagementScore))),
    profitability_score: Math.min(100, Math.max(0, Math.round(profitabilityScore))),
    discipline_score: Math.min(100, Math.max(0, Math.round(disciplineScore))),
    execution_score: Math.min(100, Math.max(0, Math.round(executionScore))),
    win_rate: Math.round(winRate * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    avg_win_loss_ratio: Math.round(avgWinLossRatio * 100) / 100,
    total_trades: trades.length
  };
}

function calculateProfitabilityScore(winRate: number, profitFactor: number, avgWinLossRatio: number): number {
  const winRateScore = Math.min(winRate * 1.5, 50);

  const profitFactorScore = Math.min(profitFactor * 15, 30);

  const ratioScore = Math.min(avgWinLossRatio * 10, 20);

  return winRateScore + profitFactorScore + ratioScore;
}

function calculateConsistencyScore(trades: TradeData[]): number {
  if (trades.length < 10) return 50;

  const sortedByDate = [...trades].sort((a, b) =>
    new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );

  const windowSize = 10;
  const windows: number[] = [];

  for (let i = 0; i <= sortedByDate.length - windowSize; i++) {
    const window = sortedByDate.slice(i, i + windowSize);
    const winRate = window.filter(t => t.profit_loss > 0).length / windowSize;
    windows.push(winRate);
  }

  const avgWindowWinRate = windows.reduce((sum, wr) => sum + wr, 0) / windows.length;
  const variance = windows.reduce((sum, wr) => sum + Math.pow(wr - avgWindowWinRate, 2), 0) / windows.length;
  const standardDeviation = Math.sqrt(variance);

  const consistencyScore = Math.max(0, 100 - (standardDeviation * 300));

  const profitConsistency = calculateProfitConsistency(sortedByDate);

  return (consistencyScore * 0.6) + (profitConsistency * 0.4);
}

function calculateProfitConsistency(trades: TradeData[]): number {
  const dailyPnL = new Map<string, number>();

  trades.forEach(trade => {
    const date = new Date(trade.entry_time).toISOString().split('T')[0];
    dailyPnL.set(date, (dailyPnL.get(date) || 0) + trade.profit_loss);
  });

  const dailyResults = Array.from(dailyPnL.values());
  const positiveDays = dailyResults.filter(pnl => pnl > 0).length;
  const winningDaysRate = (positiveDays / dailyResults.length) * 100;

  return Math.min(winningDaysRate * 1.2, 100);
}

function calculateRiskManagementScore(trades: TradeData[], avgWinLossRatio: number): number {
  let score = 0;

  if (avgWinLossRatio >= 2.0) score += 40;
  else if (avgWinLossRatio >= 1.5) score += 30;
  else if (avgWinLossRatio >= 1.0) score += 20;
  else score += 10;

  const tradesWithRR = trades.filter(t => t.risk_reward_ratio && t.risk_reward_ratio >= 2);
  const rrRatio = tradesWithRR.length / trades.length;
  score += Math.min(rrRatio * 40, 40);

  const maxDrawdownScore = calculateMaxDrawdownScore(trades);
  score += maxDrawdownScore * 0.2;

  return score;
}

function calculateMaxDrawdownScore(trades: TradeData[]): number {
  let peak = 0;
  let currentBalance = 0;
  let maxDrawdown = 0;

  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );

  sortedTrades.forEach(trade => {
    currentBalance += trade.profit_loss;
    peak = Math.max(peak, currentBalance);
    const drawdown = peak - currentBalance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  const totalProfit = sortedTrades.reduce((sum, t) => sum + t.profit_loss, 0);
  if (totalProfit <= 0) return 50;

  const drawdownPercent = (maxDrawdown / Math.abs(totalProfit)) * 100;

  if (drawdownPercent <= 10) return 100;
  if (drawdownPercent <= 20) return 80;
  if (drawdownPercent <= 30) return 60;
  if (drawdownPercent <= 50) return 40;
  return 20;
}

function calculateDisciplineScore(trades: TradeData[]): number {
  let score = 0;

  const tradesWithConfluences = trades.filter(t => t.confluence_count && t.confluence_count >= 3);
  const confluenceRatio = tradesWithConfluences.length / trades.length;
  score += Math.min(confluenceRatio * 50, 50);

  const avgHoldTime = calculateAverageHoldTime(trades);
  if (avgHoldTime > 30 && avgHoldTime < 300) {
    score += 30;
  } else if (avgHoldTime >= 15 && avgHoldTime <= 500) {
    score += 20;
  } else {
    score += 10;
  }

  const overtradingPenalty = calculateOvertradingPenalty(trades);
  score += overtradingPenalty;

  return score;
}

function calculateAverageHoldTime(trades: TradeData[]): number {
  const holdTimes = trades.map(t => {
    const entry = new Date(t.entry_time).getTime();
    const exit = new Date(t.exit_time).getTime();
    return (exit - entry) / (1000 * 60);
  });

  return holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length;
}

function calculateOvertradingPenalty(trades: TradeData[]): number {
  const dailyTradeCounts = new Map<string, number>();

  trades.forEach(trade => {
    const date = new Date(trade.entry_time).toISOString().split('T')[0];
    dailyTradeCounts.set(date, (dailyTradeCounts.get(date) || 0) + 1);
  });

  const avgDailyTrades = Array.from(dailyTradeCounts.values()).reduce((sum, count) => sum + count, 0) / dailyTradeCounts.size;

  if (avgDailyTrades <= 5) return 20;
  if (avgDailyTrades <= 10) return 15;
  if (avgDailyTrades <= 15) return 10;
  return 5;
}

function calculateExecutionScore(trades: TradeData[], winRate: number): number {
  let score = 0;

  if (winRate >= 60) score += 40;
  else if (winRate >= 50) score += 30;
  else if (winRate >= 40) score += 20;
  else score += 10;

  const recentTrades = trades.slice(-20);
  const recentWinRate = (recentTrades.filter(t => t.profit_loss > 0).length / recentTrades.length) * 100;

  if (recentWinRate > winRate) {
    score += 30;
  } else if (recentWinRate >= winRate - 5) {
    score += 20;
  } else {
    score += 10;
  }

  const profitableTrades = trades.filter(t => t.profit_loss > 0);
  const avgProfit = profitableTrades.reduce((sum, t) => sum + t.profit_loss, 0) / profitableTrades.length;
  const largeWins = profitableTrades.filter(t => t.profit_loss > avgProfit * 2).length;
  const largeWinRatio = largeWins / profitableTrades.length;

  score += Math.min(largeWinRatio * 30, 30);

  return score;
}

export async function saveNOVAScore(breakdown: NOVAScoreBreakdown, accountId: string | null = null): Promise<NOVAScore | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('nova_score')
      .insert({
        user_id: user.id,
        score: breakdown.overall_score,
        date: new Date().toISOString().split('T')[0],
        factors: breakdown
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving NOVAScore:', error);
    return null;
  }
}

export async function getLatestNOVAScore(accountId: string | null = null): Promise<NOVAScore | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('nova_score')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const factors = (data.factors || {}) as any;
    return {
      id: data.id,
      user_id: data.user_id,
      account_id: null,
      calculation_date: data.date,
      created_at: data.created_at,
      updated_at: data.created_at,
      overall_score: data.score,
      consistency_score: factors.consistency_score || 0,
      risk_management_score: factors.risk_management_score || 0,
      profitability_score: factors.profitability_score || 0,
      discipline_score: factors.discipline_score || 0,
      execution_score: factors.execution_score || 0,
      win_rate: factors.win_rate || 0,
      profit_factor: factors.profit_factor || 0,
      avg_win_loss_ratio: factors.avg_win_loss_ratio || 0,
      total_trades: factors.total_trades || 0,
    } as NOVAScore;
  } catch (error) {
    console.error('Error fetching NOVAScore:', error);
    return null;
  }
}

export async function getNOVAScoreHistory(accountId: string | null = null, limit: number = 30): Promise<NOVAScore[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('nova_score')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => {
      const factors = (row.factors || {}) as any;
      return {
        id: row.id,
        user_id: row.user_id,
        account_id: null,
        calculation_date: row.date,
        created_at: row.created_at,
        updated_at: row.created_at,
        overall_score: row.score,
        consistency_score: factors.consistency_score || 0,
        risk_management_score: factors.risk_management_score || 0,
        profitability_score: factors.profitability_score || 0,
        discipline_score: factors.discipline_score || 0,
        execution_score: factors.execution_score || 0,
        win_rate: factors.win_rate || 0,
        profit_factor: factors.profit_factor || 0,
        avg_win_loss_ratio: factors.avg_win_loss_ratio || 0,
        total_trades: factors.total_trades || 0,
      } as NOVAScore;
    });
  } catch (error) {
    console.error('Error fetching NOVAScore history:', error);
    return [];
  }
}
