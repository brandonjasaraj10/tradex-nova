import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisRequest {
  user_id: string;
  days_back?: number;
  account_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, days_back = 90, account_id }: AnalysisRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_back);
    const cutoffDateStr = cutoffDate.toISOString();

    const midpointDate = new Date();
    midpointDate.setDate(midpointDate.getDate() - Math.floor(days_back / 2));
    const midpointDateStr = midpointDate.toISOString();

    // journal_entries has no category column - a single entry can carry
    // both trade fields (manual_pnl, symbol) and psychology fields
    // (stress_level, mood, etc.) at once, or neither. Fetch once and split
    // by which fields are actually populated instead.
    //
    // It does have account_id, despite what the comment here used to claim,
    // and account_id has been an accepted parameter of this function all
    // along while nothing ever filtered on it - so asking Nova about one
    // account silently answered for all of them.
    let journalQuery = supabaseClient
      .from("journal_entries")
      .select("*")
      .eq("user_id", user_id)
      .gte("entry_date", cutoffDateStr)
      .order("entry_date", { ascending: false });

    if (account_id) {
      journalQuery = journalQuery.eq("account_id", account_id);
    }

    /*
      Trades live in their own table, and this function never looked at it.

      Everything a CSV import or broker sync writes lands in `trades`, so
      Nova's answers were drawn from journal entries alone. On a real test
      account that meant Nova told the user they had "6 trades over the last
      90 days" when the account held 26, and reported consistency 13 and
      discipline 0 against the 50s displayed on the very page the chat is
      embedded in. Users do not read that as two data sources - they read it
      as the product not knowing their own numbers.

      Mapped onto the journal shape so the analysis below still handles one
      kind of object. Psychology analysis deliberately keeps using journal
      entries only: trades carry no mood, stress or confidence fields.
    */
    let tradesQuery = supabaseClient
      .from("trades")
      .select("pnl, entry_date, exit_date, symbol, direction")
      .eq("user_id", user_id)
      .gte("entry_date", cutoffDateStr)
      .order("entry_date", { ascending: false });

    if (account_id) {
      tradesQuery = tradesQuery.eq("broker_id", account_id);
    }

    const [
      journalResult,
      tradesResult,
      rulesResult,
      confluencesResult,
      profileResult,
      entryRulesResult,
      entryConfluencesResult,
      balanceResult,
    ] = await Promise.all([
      journalQuery,
      tradesQuery,
      supabaseClient
        .from("trading_rules")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true),
      supabaseClient
        .from("trading_confluences")
        .select("*")
        .eq("user_id", user_id),
      supabaseClient
        .from("user_trading_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabaseClient
        .from("journal_entry_rules")
        .select("*, trading_rules(id, rule_text, name)")
        .eq("trading_rules.user_id", user_id),
      supabaseClient
        .from("journal_entry_confluences")
        .select("*, trading_confluences(id, name)")
        .eq("trading_confluences.user_id", user_id),
      supabaseClient
        .from("account_balances")
        .select("balance, equity, recorded_at")
        .eq("user_id", user_id)
        .gte("recorded_at", cutoffDateStr)
        .order("recorded_at", { ascending: true })
        .limit(100),
    ]);

    if (journalResult.error) throw journalResult.error;

    const journalEntries = journalResult.data || [];

    const journalTrades = journalEntries.filter((e: any) => e.manual_pnl !== null && e.manual_pnl !== undefined);
    // direction is carried through so the per-trade ledger in recent_trades
    // is complete. Leaving it out stamped every imported trade "unknown",
    // and Nova - reasonably - stopped trusting the ledger and rebuilt the
    // list from the aggregates instead, which produced a trade-by-trade
    // rundown that misreported one trade's P&L and omitted another.
    const importedTrades = (tradesResult.data || []).map((t: any) => ({
      manual_pnl: t.pnl,
      entry_date: t.entry_date,
      exit_date: t.exit_date,
      symbol: t.symbol,
      direction: t.direction,
    }));

    // Newest-first: several analyses below slice off the front of this list
    // to talk about "recent" trades, an ordering that came free from the
    // journal query alone and would be lost by plain concatenation.
    const trades = [...journalTrades, ...importedTrades].sort(
      (a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );
    const psychologyEntries = journalEntries.filter((e: any) =>
      e.stress_level !== null || e.mood_before !== null || e.mood_after !== null ||
      e.confidence_level !== null || e.rule_following !== null
    );
    const tradingRules = rulesResult.data || [];
    const confluences = confluencesResult.data || [];
    const userProfile = profileResult.data;
    const entryRules = entryRulesResult.data || [];
    const entryConfluences = entryConfluencesResult.data || [];
    const balanceHistory = balanceResult.data || [];

    const getPnl = (t: any) => t.manual_pnl ?? t.pnl ?? 0;
    const getSymbol = (t: any) => t.symbol || "Unknown";
    const getSession = (t: any) => "Unknown";
    const getDuration = (t: any) => t.trade_duration || "Unknown";
    const getDirection = (t: any) => (t.direction || "unknown").toLowerCase();
    const getEntryReason = (t: any) => t.pre_market_notes || "";
    const getExitReason = (t: any) => t.post_market_notes || "";
    const getPositionSize = (t: any) => t.position_size || null;
    const getEntryDate = (t: any) => t.entry_date || "";

    const winningTrades = trades.filter((t) => getPnl(t) > 0);
    const losingTrades = trades.filter((t) => getPnl(t) < 0);
    const totalPnL = trades.reduce((sum, t) => sum + getPnl(t), 0);
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + getPnl(t), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + getPnl(t), 0) / losingTrades.length
      : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + getPnl(t), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + getPnl(t), 0));

    const symbolFrequency: Record<string, { count: number; wins: number; losses: number; totalPnl: number }> = {};
    const sessionPerformance: Record<string, { count: number; wins: number; pnl: number }> = {};
    const durationPerformance: Record<string, { count: number; wins: number; pnl: number }> = {};
    const directionPerformance = { long: { count: 0, wins: 0, pnl: 0 }, short: { count: 0, wins: 0, pnl: 0 } };
    const dayOfWeekPerformance: Record<string, { count: number; wins: number; pnl: number }> = {};
    const entryReasonFrequency: Record<string, { count: number; wins: number; pnl: number }> = {};
    const exitReasonFrequency: Record<string, { count: number; wins: number; pnl: number }> = {};
    const dailyTradeCount: Record<string, number> = {};

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    trades.forEach((t) => {
      const pnl = getPnl(t);
      const isWin = pnl > 0;
      const symbol = getSymbol(t);
      const session = getSession(t);
      const duration = getDuration(t);
      const direction = getDirection(t);
      const entryReason = getEntryReason(t);
      const exitReason = getExitReason(t);
      const dateStr = getEntryDate(t);

      if (!symbolFrequency[symbol]) symbolFrequency[symbol] = { count: 0, wins: 0, losses: 0, totalPnl: 0 };
      symbolFrequency[symbol].count++;
      symbolFrequency[symbol].totalPnl += pnl;
      if (isWin) symbolFrequency[symbol].wins++;
      if (pnl < 0) symbolFrequency[symbol].losses++;

      if (!sessionPerformance[session]) sessionPerformance[session] = { count: 0, wins: 0, pnl: 0 };
      sessionPerformance[session].count++;
      sessionPerformance[session].pnl += pnl;
      if (isWin) sessionPerformance[session].wins++;

      if (!durationPerformance[duration]) durationPerformance[duration] = { count: 0, wins: 0, pnl: 0 };
      durationPerformance[duration].count++;
      durationPerformance[duration].pnl += pnl;
      if (isWin) durationPerformance[duration].wins++;

      if (direction === "long" || direction === "short") {
        directionPerformance[direction].count++;
        directionPerformance[direction].pnl += pnl;
        if (isWin) directionPerformance[direction].wins++;
      }

      try {
        const d = new Date(dateStr);
        const dayName = dayNames[d.getDay()];
        if (!dayOfWeekPerformance[dayName]) dayOfWeekPerformance[dayName] = { count: 0, wins: 0, pnl: 0 };
        dayOfWeekPerformance[dayName].count++;
        dayOfWeekPerformance[dayName].pnl += pnl;
        if (isWin) dayOfWeekPerformance[dayName].wins++;

        const dayKey = dateStr.split("T")[0];
        dailyTradeCount[dayKey] = (dailyTradeCount[dayKey] || 0) + 1;
      } catch {}

      if (entryReason && entryReason.length > 2) {
        const reason = entryReason.toLowerCase().trim();
        if (!entryReasonFrequency[reason]) entryReasonFrequency[reason] = { count: 0, wins: 0, pnl: 0 };
        entryReasonFrequency[reason].count++;
        entryReasonFrequency[reason].pnl += pnl;
        if (isWin) entryReasonFrequency[reason].wins++;
      }

      if (exitReason && exitReason.length > 2) {
        const reason = exitReason.toLowerCase().trim();
        if (!exitReasonFrequency[reason]) exitReasonFrequency[reason] = { count: 0, wins: 0, pnl: 0 };
        exitReasonFrequency[reason].count++;
        exitReasonFrequency[reason].pnl += pnl;
        if (isWin) exitReasonFrequency[reason].wins++;
      }
    });

    const tradeCounts = Object.values(dailyTradeCount);
    const avgTradesPerDay = tradeCounts.length > 0
      ? tradeCounts.reduce((s, c) => s + c, 0) / tradeCounts.length
      : 0;
    const maxTradesInDay = tradeCounts.length > 0 ? Math.max(...tradeCounts) : 0;
    const overtradingDays = tradeCounts.filter((c) => c > avgTradesPerDay * 1.5 && c >= 4).length;

    const ruleCompliance: Record<string, { rule_name: string; followed: number; broken: number; rate: number }> = {};
    tradingRules.forEach((rule) => {
      ruleCompliance[rule.id] = { rule_name: rule.name || rule.rule_text, followed: 0, broken: 0, rate: 0 };
    });

    // Journal entries only: journal_entry_rules can only ever point at a
    // journal entry, and imported trades carry no id here at all - including
    // them would just seed the set with undefined.
    const entryIdSet = new Set(journalTrades.map((t: any) => t.id));
    entryRules.forEach((er) => {
      if (!entryIdSet.has(er.journal_entry_id)) return;
      const ruleId = er.rule_id;
      if (ruleCompliance[ruleId]) {
        if (er.followed) ruleCompliance[ruleId].followed++;
        else ruleCompliance[ruleId].broken++;
      }
    });

    Object.values(ruleCompliance).forEach((rc) => {
      const total = rc.followed + rc.broken;
      rc.rate = total > 0 ? (rc.followed / total) * 100 : 0;
    });

    const confluenceUsage: Record<string, { name: string; used: number; present: number }> = {};
    confluences.forEach((c) => {
      confluenceUsage[c.id] = { name: c.name, used: 0, present: 0 };
    });

    entryConfluences.forEach((ec) => {
      const confId = ec.confluence_id;
      if (confluenceUsage[confId]) {
        confluenceUsage[confId].used++;
        if (ec.present || ec.checked) confluenceUsage[confId].present++;
      }
    });

    const emotionalPatterns: Record<string, { count: number; totalStress: number; totalMood: number; totalConfidence: number; emotions: string[] }> = {};
    const psychByDate: Record<string, any> = {};

    psychologyEntries.forEach((entry) => {
      const state = entry.psychology_data?.emotional_state || entry.mood || "unknown";
      if (!emotionalPatterns[state]) {
        emotionalPatterns[state] = { count: 0, totalStress: 0, totalMood: 0, totalConfidence: 0, emotions: [] };
      }
      emotionalPatterns[state].count++;
      emotionalPatterns[state].totalStress += entry.psychology_data?.stress_level || entry.stress_level || 0;
      emotionalPatterns[state].totalMood += entry.psychology_data?.mood_rating || entry.mood_before || 0;

      const confLevel = entry.psychology_data?.confidence_level || entry.confidence_level;
      if (typeof confLevel === "number") emotionalPatterns[state].totalConfidence += confLevel;
      else if (confLevel === "high") emotionalPatterns[state].totalConfidence += 8;
      else if (confLevel === "medium") emotionalPatterns[state].totalConfidence += 5;
      else if (confLevel === "low") emotionalPatterns[state].totalConfidence += 2;

      const emotions = entry.psychology_data?.emotions || [];
      emotionalPatterns[state].emotions.push(...emotions);

      const dateKey = (entry.entry_date || "").split("T")[0];
      if (dateKey) {
        psychByDate[dateKey] = {
          emotional_state: state,
          stress_level: entry.psychology_data?.stress_level || entry.stress_level || 0,
          mood_rating: entry.psychology_data?.mood_rating || entry.mood_before || 0,
          confidence: confLevel,
          discipline: entry.psychology_data?.discipline_level || null,
        };
      }
    });

    const emotionalSummary: Record<string, { count: number; avgStress: number; avgMood: number; avgConfidence: number }> = {};
    Object.entries(emotionalPatterns).forEach(([state, data]) => {
      emotionalSummary[state] = {
        count: data.count,
        avgStress: data.count > 0 ? data.totalStress / data.count : 0,
        avgMood: data.count > 0 ? data.totalMood / data.count : 0,
        avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
      };
    });

    const psychPerformanceCorrelation: {
      high_stress_trades: { count: number; win_rate: number; avg_pnl: number };
      low_stress_trades: { count: number; win_rate: number; avg_pnl: number };
      high_confidence_trades: { count: number; win_rate: number; avg_pnl: number };
      low_confidence_trades: { count: number; win_rate: number; avg_pnl: number };
    } = {
      high_stress_trades: { count: 0, win_rate: 0, avg_pnl: 0 },
      low_stress_trades: { count: 0, win_rate: 0, avg_pnl: 0 },
      high_confidence_trades: { count: 0, win_rate: 0, avg_pnl: 0 },
      low_confidence_trades: { count: 0, win_rate: 0, avg_pnl: 0 },
    };

    const highStressTrades: number[] = [];
    const lowStressTrades: number[] = [];
    const highConfTrades: number[] = [];
    const lowConfTrades: number[] = [];

    trades.forEach((t) => {
      const dateKey = getEntryDate(t).split("T")[0];
      const psych = psychByDate[dateKey];
      if (!psych) return;

      const pnl = getPnl(t);

      if (psych.stress_level >= 6) highStressTrades.push(pnl);
      else if (psych.stress_level > 0) lowStressTrades.push(pnl);

      const conf = psych.confidence;
      if (conf === "high" || (typeof conf === "number" && conf >= 7)) highConfTrades.push(pnl);
      else if (conf === "low" || (typeof conf === "number" && conf <= 4)) lowConfTrades.push(pnl);
    });

    if (highStressTrades.length > 0) {
      const wins = highStressTrades.filter((p) => p > 0).length;
      psychPerformanceCorrelation.high_stress_trades = {
        count: highStressTrades.length,
        win_rate: (wins / highStressTrades.length) * 100,
        avg_pnl: highStressTrades.reduce((s, p) => s + p, 0) / highStressTrades.length,
      };
    }
    if (lowStressTrades.length > 0) {
      const wins = lowStressTrades.filter((p) => p > 0).length;
      psychPerformanceCorrelation.low_stress_trades = {
        count: lowStressTrades.length,
        win_rate: (wins / lowStressTrades.length) * 100,
        avg_pnl: lowStressTrades.reduce((s, p) => s + p, 0) / lowStressTrades.length,
      };
    }
    if (highConfTrades.length > 0) {
      const wins = highConfTrades.filter((p) => p > 0).length;
      psychPerformanceCorrelation.high_confidence_trades = {
        count: highConfTrades.length,
        win_rate: (wins / highConfTrades.length) * 100,
        avg_pnl: highConfTrades.reduce((s, p) => s + p, 0) / highConfTrades.length,
      };
    }
    if (lowConfTrades.length > 0) {
      const wins = lowConfTrades.filter((p) => p > 0).length;
      psychPerformanceCorrelation.low_confidence_trades = {
        count: lowConfTrades.length,
        win_rate: (wins / lowConfTrades.length) * 100,
        avg_pnl: lowConfTrades.reduce((s, p) => s + p, 0) / lowConfTrades.length,
      };
    }

    const recentHalfTrades = trades.filter((t) => new Date(getEntryDate(t)) >= midpointDate);
    const olderHalfTrades = trades.filter((t) => new Date(getEntryDate(t)) < midpointDate);

    const recentWinRate = recentHalfTrades.length > 0
      ? (recentHalfTrades.filter((t) => getPnl(t) > 0).length / recentHalfTrades.length) * 100
      : 0;
    const olderWinRate = olderHalfTrades.length > 0
      ? (olderHalfTrades.filter((t) => getPnl(t) > 0).length / olderHalfTrades.length) * 100
      : 0;
    const recentPnl = recentHalfTrades.reduce((s, t) => s + getPnl(t), 0);
    const olderPnl = olderHalfTrades.reduce((s, t) => s + getPnl(t), 0);

    const trendAnalysis = {
      recent_period: {
        trades: recentHalfTrades.length,
        win_rate: recentWinRate,
        pnl: recentPnl,
      },
      older_period: {
        trades: olderHalfTrades.length,
        win_rate: olderWinRate,
        pnl: olderPnl,
      },
      win_rate_trend: recentWinRate - olderWinRate,
      pnl_trend: recentPnl - olderPnl,
      improving: recentWinRate > olderWinRate && recentPnl > olderPnl,
      declining: recentWinRate < olderWinRate && recentPnl < olderPnl,
    };

    const positionSizes = trades
      .map((t) => getPositionSize(t))
      .filter((ps) => ps !== null && ps !== undefined);

    const consistencyScore = calculateConsistencyScore(trades, getPnl);
    const disciplineScore = calculateDisciplineScore(entryRules, entryIdSet);

    const analysis = {
      summary: {
        total_trades: trades.length,
        winning_trades: winningTrades.length,
        losing_trades: losingTrades.length,
        win_rate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        total_pnl: totalPnL,
        avg_win: avgWin,
        avg_loss: avgLoss,
        /*
          Profit factor is gross profit over gross loss. This reported
          avgWin / avgLoss instead, which is the average win/loss ratio - a
          different, consistently flatter-looking number. On a real account
          it made Nova announce a profit factor of 1.88 while every other
          screen in the app said 1.38 for the same trades, overstating it by
          more than a third.

          Both are worth having, so both are sent now under their own names.
        */
        profit_factor: grossLoss !== 0 ? grossProfit / grossLoss : 0,
        avg_win_loss_ratio: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
        /*
          Named for what they actually measure, not "consistency" and
          "discipline".

          Those two names are also used by the NOVA Score panel on screen,
          which computes them completely differently - consistency there is
          the spread of win rate across rolling 10-trade windows, discipline
          there is confluence use plus hold time plus an overtrading penalty.
          Here they are the coefficient of variation of P&L, and the share of
          logged rules followed. On one real account the panel showed 50 and
          50 while Nova, quoting these, said 13 and 0 for the same trades in
          the same moment. Two different measurements are fine; two different
          measurements wearing one name is not.
        */
        pnl_variability_score: consistencyScore,
        rule_compliance_score: disciplineScore,
        avg_trades_per_day: Math.round(avgTradesPerDay * 10) / 10,
        max_trades_in_day: maxTradesInDay,
        overtrading_days: overtradingDays,
        total_trading_days: Object.keys(dailyTradeCount).length,
        psychology_entries_count: psychologyEntries.length,
      },
      patterns: {
        by_symbol: symbolFrequency,
        by_session: sessionPerformance,
        by_duration: durationPerformance,
        by_direction: directionPerformance,
        by_day_of_week: dayOfWeekPerformance,
        by_entry_reason: Object.fromEntries(
          Object.entries(entryReasonFrequency).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
        ),
        by_exit_reason: Object.fromEntries(
          Object.entries(exitReasonFrequency).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
        ),
      },
      rule_compliance: ruleCompliance,
      confluence_usage: confluenceUsage,
      emotional_patterns: emotionalSummary,
      psychology_performance_correlation: psychPerformanceCorrelation,
      trend_analysis: trendAnalysis,
      position_sizes: positionSizes.length > 0 ? {
        count: positionSizes.length,
        samples: positionSizes.slice(0, 20),
      } : null,
      balance_trajectory: balanceHistory.length > 0 ? {
        data_points: balanceHistory.length,
        first_balance: balanceHistory[0]?.balance,
        latest_balance: balanceHistory[balanceHistory.length - 1]?.balance,
        growth: balanceHistory.length >= 2
          ? ((balanceHistory[balanceHistory.length - 1].balance - balanceHistory[0].balance) / balanceHistory[0].balance) * 100
          : 0,
      } : null,
      recent_trades: trades.slice(0, 20).map((t) => ({
        date: t.entry_date,
        symbol: getSymbol(t),
        direction: getDirection(t),
        pnl: getPnl(t),
        entry_reason: getEntryReason(t),
        exit_reason: getExitReason(t),
        position_size: getPositionSize(t),
        duration: getDuration(t),
      })),
      user_profile: userProfile,
      trading_rules: tradingRules?.map((r) => ({ id: r.id, name: r.name, rule_text: r.rule_text })),
      confluences: confluences?.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      analysis_period: {
        days: days_back,
        start_date: cutoffDateStr,
        end_date: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-trading-performance:", error);
    return new Response(
      JSON.stringify({ error: "Failed to analyze trading performance", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateConsistencyScore(trades: any[], getPnl: (t: any) => number): number {
  if (trades.length < 5) return 0;
  const pnls = trades.map((t) => getPnl(t));
  const avg = pnls.reduce((sum, pnl) => sum + pnl, 0) / pnls.length;
  const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - avg, 2), 0) / pnls.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avg !== 0 ? stdDev / Math.abs(avg) : 0;
  return Math.round(Math.max(0, 100 - coefficientOfVariation * 20));
}

function calculateDisciplineScore(entryRules: any[], tradeIdSet: Set<string>): number {
  const relevant = entryRules.filter((er) => tradeIdSet.has(er.journal_entry_id));
  if (relevant.length === 0) return 0;
  const followed = relevant.filter((er) => er.followed).length;
  return Math.round((followed / relevant.length) * 100);
}
