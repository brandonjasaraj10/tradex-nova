import { toLocalDateStr } from '../utils/dateHelpers';

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
  /*
    Real figures for the Performance Metrics panel. It previously derived
    these from the summary numbers it already had, which produced values
    that were not what their labels claimed: "Best Trade" was
    max(win_rate, profit_factor) rendered as a percentage, "Success Streak"
    was win_rate / 10 (so a single trade displayed a 10-trade streak),
    "Monthly Growth" was profit_factor * 12, and "Avg Hold Time" was the
    hardcoded string 2.4h for every user. They are computed from the trades
    themselves here instead.
  */
  best_trade: number;
  worst_trade: number;
  // null when no trade carries a usable entry/exit pair - a journal entry
  // logged for a day has no times, and inventing one would be the same
  // mistake as the hardcoded 2.4h.
  avg_hold_minutes: number | null;
  longest_win_streak: number;
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
      total_trades: 0,
      best_trade: 0,
      worst_trade: 0,
      avg_hold_minutes: null,
      longest_win_streak: 0
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
    best_trade: Math.max(...trades.map(t => t.profit_loss)),
    worst_trade: Math.min(...trades.map(t => t.profit_loss)),
    avg_hold_minutes: calculateRealAverageHoldMinutes(trades),
    longest_win_streak: calculateLongestWinStreak(trades),
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

/*
  Consistency needs enough trades to have something to be consistent across.

  Below this it returns a flat 50 - a placeholder, not a measurement. The UI
  has to know the difference: the Nova page labelled this score "Based on N
  trades", which claimed it was measured from exactly the trades the function
  had just discarded.
*/
export const MIN_TRADES_FOR_CONSISTENCY = 10;

function calculateConsistencyScore(trades: TradeData[]): number {
  if (trades.length < MIN_TRADES_FOR_CONSISTENCY) return 50;

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
    const date = toLocalDateStr(new Date(trade.entry_time));
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
    const date = toLocalDateStr(new Date(trade.entry_time));
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
  const recentWinRate = recentTrades.length > 0
    ? (recentTrades.filter(t => t.profit_loss > 0).length / recentTrades.length) * 100
    : 0;

  if (recentWinRate > winRate) {
    score += 30;
  } else if (recentWinRate >= winRate - 5) {
    score += 20;
  } else {
    score += 10;
  }

  /*
    With no winning trades there is nothing to say about how big the wins
    were, so this component contributes nothing.

    It used to divide by profitableTrades.length unguarded. With no winners
    that is 0/0, and the NaN propagated through the weighted sum until
    overall_score was itself NaN - which reached the screen as a literal
    "NaN" where the score should be. It stayed hidden while the score always
    covered all time, because some winning trade nearly always existed
    somewhere in a user's history. A date-ranged score reaches it the first
    time somebody selects a week they only lost in.
  */
  const profitableTrades = trades.filter(t => t.profit_loss > 0);

  if (profitableTrades.length > 0) {
    const avgProfit = profitableTrades.reduce((sum, t) => sum + t.profit_loss, 0) / profitableTrades.length;
    const largeWins = profitableTrades.filter(t => t.profit_loss > avgProfit * 2).length;
    const largeWinRatio = largeWins / profitableTrades.length;

    score += Math.min(largeWinRatio * 30, 30);
  }

  return score;
}


/*
  Average hold time from real timestamps only.

  Returns null rather than a number when nothing usable exists. A trade
  logged as a journal entry for a day has no entry/exit time - both collapse
  to the same date - so averaging those in would quietly drag the figure
  toward zero and present it as fact.
*/
function calculateRealAverageHoldMinutes(trades: TradeData[]): number | null {
  const durations = trades
    .map(t => {
      const entry = new Date(t.entry_time).getTime();
      const exit = new Date(t.exit_time).getTime();
      if (isNaN(entry) || isNaN(exit)) return null;
      const minutes = (exit - entry) / 60000;
      return minutes > 0 ? minutes : null;
    })
    .filter((m): m is number => m !== null);

  if (durations.length === 0) return null;
  return durations.reduce((sum, m) => sum + m, 0) / durations.length;
}

// Longest run of consecutive wins, in chronological order.
function calculateLongestWinStreak(trades: TradeData[]): number {
  const chronological = [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  let best = 0;
  let run = 0;
  for (const t of chronological) {
    if (t.profit_loss > 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}
