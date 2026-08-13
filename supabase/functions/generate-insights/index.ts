import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateInsightsRequest {
  user_id: string;
  force_refresh?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, force_refresh = false }: GenerateInsightsRequest = await req.json();

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

    if (!force_refresh) {
      const { data: existingInsights } = await supabaseClient
        .from("user_insights")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_dismissed", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      if (existingInsights && existingInsights.length > 0) {
        const { data: allInsights } = await supabaseClient
          .from("user_insights")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_dismissed", false)
          .gt("expires_at", new Date().toISOString())
          .order("priority", { ascending: false })
          .limit(10);

        return new Response(
          JSON.stringify({ insights: allInsights, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString();

    const midpointDate = new Date();
    midpointDate.setDate(midpointDate.getDate() - 15);

    const [tradesResult, psychResult, rulesResult, entryRulesResult, profileResult] = await Promise.all([
      supabaseClient
        .from("journal_entries")
        .select("*")
        .eq("user_id", user_id)
        .eq("category", "trade")
        .gte("entry_date", cutoffDateStr)
        .order("entry_date", { ascending: false }),
      supabaseClient
        .from("journal_entries")
        .select("*")
        .eq("user_id", user_id)
        .eq("category", "psychology")
        .gte("entry_date", cutoffDateStr)
        .order("entry_date", { ascending: false }),
      supabaseClient
        .from("trading_rules")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true),
      supabaseClient
        .from("journal_entry_rules")
        .select("*, trading_rules(id, rule_text, name)")
        .eq("trading_rules.user_id", user_id),
      supabaseClient
        .from("user_trading_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle(),
    ]);

    const trades = tradesResult.data || [];
    const psychologyEntries = psychResult.data || [];
    const tradingRules = rulesResult.data || [];
    const entryRules = entryRulesResult.data || [];
    const userProfile = profileResult.data;

    if (trades.length < 3 && psychologyEntries.length < 2) {
      return new Response(
        JSON.stringify({
          insights: [],
          message: "Not enough data to generate insights yet. Keep logging trades and psychology entries."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const getPnl = (t: any) => t.trade_data?.pnl || t.manual_pnl || t.pnl || 0;
    const getSymbol = (t: any) => t.trade_data?.symbol || t.symbol || "Unknown";
    const getSession = (t: any) => t.trade_data?.session || "Unknown";
    const getEntryDate = (t: any) => t.entry_date || "";

    const insights: any[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const winningTrades = trades.filter((t) => getPnl(t) > 0);
    const losingTrades = trades.filter((t) => getPnl(t) < 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const totalPnL = trades.reduce((sum, t) => sum + getPnl(t), 0);

    const symbolPerformance: Record<string, { count: number; wins: number; totalPnl: number }> = {};
    const sessionPerformance: Record<string, { count: number; wins: number; totalPnl: number }> = {};
    const dailyTradeCount: Record<string, number> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeekPerformance: Record<string, { count: number; wins: number; pnl: number }> = {};

    trades.forEach((t) => {
      const pnl = getPnl(t);
      const isWin = pnl > 0;
      const symbol = getSymbol(t);
      const session = getSession(t);
      const dateStr = getEntryDate(t);

      if (!symbolPerformance[symbol]) symbolPerformance[symbol] = { count: 0, wins: 0, totalPnl: 0 };
      symbolPerformance[symbol].count++;
      symbolPerformance[symbol].totalPnl += pnl;
      if (isWin) symbolPerformance[symbol].wins++;

      if (session !== "Unknown") {
        if (!sessionPerformance[session]) sessionPerformance[session] = { count: 0, wins: 0, totalPnl: 0 };
        sessionPerformance[session].count++;
        sessionPerformance[session].totalPnl += pnl;
        if (isWin) sessionPerformance[session].wins++;
      }

      try {
        const dayKey = dateStr.split("T")[0];
        dailyTradeCount[dayKey] = (dailyTradeCount[dayKey] || 0) + 1;

        const d = new Date(dateStr);
        const dayName = dayNames[d.getDay()];
        if (!dayOfWeekPerformance[dayName]) dayOfWeekPerformance[dayName] = { count: 0, wins: 0, pnl: 0 };
        dayOfWeekPerformance[dayName].count++;
        dayOfWeekPerformance[dayName].pnl += pnl;
        if (isWin) dayOfWeekPerformance[dayName].wins++;
      } catch {}
    });

    const bestSymbol = Object.entries(symbolPerformance)
      .filter(([_, stats]) => stats.count >= 3)
      .sort((a, b) => (b[1].wins / b[1].count) - (a[1].wins / a[1].count))[0];

    if (bestSymbol && bestSymbol[1].count >= 3) {
      const symbolWinRate = ((bestSymbol[1].wins / bestSymbol[1].count) * 100).toFixed(0);
      insights.push({
        user_id,
        insight_type: "performance",
        title: "Best Performing Symbol",
        description: `Your highest win rate is ${symbolWinRate}% on ${bestSymbol[0]} across ${bestSymbol[1].count} trades. This is where your edge is strongest.`,
        category: "positive",
        priority: 9,
        data: { symbol: bestSymbol[0], win_rate: symbolWinRate, total_trades: bestSymbol[1].count, total_pnl: bestSymbol[1].totalPnl },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    const worstSymbol = Object.entries(symbolPerformance)
      .filter(([_, stats]) => stats.count >= 3)
      .sort((a, b) => (a[1].wins / a[1].count) - (b[1].wins / b[1].count))[0];

    if (worstSymbol && worstSymbol[1].count >= 3 && (worstSymbol[1].wins / worstSymbol[1].count) < 0.4) {
      const symbolWinRate = ((worstSymbol[1].wins / worstSymbol[1].count) * 100).toFixed(0);
      insights.push({
        user_id,
        insight_type: "risk",
        title: "Underperforming Symbol",
        description: `${worstSymbol[0]} has only a ${symbolWinRate}% win rate over ${worstSymbol[1].count} trades, costing you $${Math.abs(worstSymbol[1].totalPnl).toFixed(0)}. Consider reducing exposure or paper trading this symbol.`,
        category: "warning",
        priority: 8,
        data: { symbol: worstSymbol[0], win_rate: symbolWinRate, total_trades: worstSymbol[1].count, total_pnl: worstSymbol[1].totalPnl },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    const bestSession = Object.entries(sessionPerformance)
      .filter(([_, stats]) => stats.count >= 3)
      .sort((a, b) => b[1].totalPnl - a[1].totalPnl)[0];

    if (bestSession && bestSession[1].count >= 3) {
      const sessionWinRate = ((bestSession[1].wins / bestSession[1].count) * 100).toFixed(0);
      insights.push({
        user_id,
        insight_type: "opportunity",
        title: "Strongest Trading Session",
        description: `${bestSession[0]} session is your most profitable: ${sessionWinRate}% win rate with $${bestSession[1].totalPnl.toFixed(0)} total P&L across ${bestSession[1].count} trades.`,
        category: "positive",
        priority: 7,
        data: { session: bestSession[0], win_rate: sessionWinRate, total_trades: bestSession[1].count, total_pnl: bestSession[1].totalPnl },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (trades.length >= 5) {
      if (winRate > 65) {
        insights.push({
          user_id,
          insight_type: "performance",
          title: "Strong Win Rate",
          description: `Your ${winRate.toFixed(0)}% win rate across ${trades.length} trades shows a consistent edge. Keep following your plan.`,
          category: "positive",
          priority: 8,
          data: { win_rate: winRate.toFixed(0), total_trades: trades.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } else if (winRate < 40) {
        insights.push({
          user_id,
          insight_type: "performance",
          title: "Win Rate Needs Attention",
          description: `Your win rate is ${winRate.toFixed(0)}% over ${trades.length} trades. Review your entry criteria, check if you're following your confluences, and consider being more selective with setups.`,
          category: "warning",
          priority: 9,
          data: { win_rate: winRate.toFixed(0), total_trades: trades.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    if (trades.length >= 10) {
      const avgWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + getPnl(t), 0) / winningTrades.length
        : 0;
      const avgLoss = losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, t) => sum + getPnl(t), 0) / losingTrades.length)
        : 0;

      if (avgLoss > 0 && avgWin / avgLoss > 2) {
        insights.push({
          user_id,
          insight_type: "discipline",
          title: "Strong Risk-Reward Management",
          description: `Your average win ($${avgWin.toFixed(0)}) is ${(avgWin / avgLoss).toFixed(1)}x your average loss ($${avgLoss.toFixed(0)}). This risk management discipline is the foundation of long-term profitability.`,
          category: "positive",
          priority: 7,
          data: { avg_win: avgWin.toFixed(2), avg_loss: avgLoss.toFixed(2), ratio: (avgWin / avgLoss).toFixed(2) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } else if (avgLoss > 0 && avgWin / avgLoss < 0.8) {
        insights.push({
          user_id,
          insight_type: "risk",
          title: "Risk-Reward Imbalance",
          description: `Your average loss ($${avgLoss.toFixed(0)}) exceeds your average win ($${avgWin.toFixed(0)}). Focus on letting winners run and cutting losers faster. Review your exit strategy.`,
          category: "warning",
          priority: 9,
          data: { avg_win: avgWin.toFixed(2), avg_loss: avgLoss.toFixed(2), ratio: (avgWin / avgLoss).toFixed(2) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    const tradeCounts = Object.values(dailyTradeCount);
    const avgTradesPerDay = tradeCounts.length > 0
      ? tradeCounts.reduce((s, c) => s + c, 0) / tradeCounts.length
      : 0;
    const overtradingDays = tradeCounts.filter((c) => c > avgTradesPerDay * 1.5 && c >= 4).length;

    if (overtradingDays >= 3 && tradeCounts.length >= 5) {
      const maxTrades = Math.max(...tradeCounts);
      insights.push({
        user_id,
        insight_type: "discipline",
        title: "Overtrading Pattern Detected",
        description: `You had ${overtradingDays} days where you traded significantly more than your average (${avgTradesPerDay.toFixed(1)} trades/day), with up to ${maxTrades} trades in a single day. Overtrading often leads to impulsive decisions and lower quality setups.`,
        category: "warning",
        priority: 9,
        data: { overtrading_days: overtradingDays, avg_per_day: avgTradesPerDay.toFixed(1), max_in_day: maxTrades },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    const bestDay = Object.entries(dayOfWeekPerformance)
      .filter(([_, stats]) => stats.count >= 3)
      .sort((a, b) => (b[1].pnl / b[1].count) - (a[1].pnl / a[1].count))[0];

    const worstDay = Object.entries(dayOfWeekPerformance)
      .filter(([_, stats]) => stats.count >= 3 && stats.pnl < 0)
      .sort((a, b) => (a[1].pnl / a[1].count) - (b[1].pnl / b[1].count))[0];

    if (bestDay && bestDay[1].pnl > 0) {
      const dayWinRate = ((bestDay[1].wins / bestDay[1].count) * 100).toFixed(0);
      insights.push({
        user_id,
        insight_type: "pattern",
        title: "Best Day of the Week",
        description: `${bestDay[0]}s are your strongest day with a ${dayWinRate}% win rate and $${bestDay[1].pnl.toFixed(0)} total P&L across ${bestDay[1].count} trades.`,
        category: "positive",
        priority: 6,
        data: { day: bestDay[0], win_rate: dayWinRate, pnl: bestDay[1].pnl.toFixed(0), count: bestDay[1].count },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (worstDay) {
      insights.push({
        user_id,
        insight_type: "pattern",
        title: "Weakest Day of the Week",
        description: `${worstDay[0]}s have been unprofitable: $${worstDay[1].pnl.toFixed(0)} across ${worstDay[1].count} trades. Consider being more selective or sitting out on this day.`,
        category: "warning",
        priority: 7,
        data: { day: worstDay[0], pnl: worstDay[1].pnl.toFixed(0), count: worstDay[1].count },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    const recentTrades = trades.filter((t) => new Date(getEntryDate(t)) >= midpointDate);
    const olderTrades = trades.filter((t) => new Date(getEntryDate(t)) < midpointDate);

    if (recentTrades.length >= 3 && olderTrades.length >= 3) {
      const recentWinRate = (recentTrades.filter((t) => getPnl(t) > 0).length / recentTrades.length) * 100;
      const olderWinRate = (olderTrades.filter((t) => getPnl(t) > 0).length / olderTrades.length) * 100;
      const winRateDelta = recentWinRate - olderWinRate;

      if (winRateDelta > 10) {
        insights.push({
          user_id,
          insight_type: "consistency",
          title: "Performance Improving",
          description: `Your win rate has improved from ${olderWinRate.toFixed(0)}% to ${recentWinRate.toFixed(0)}% over the past two weeks. Whatever you're doing differently is working -- keep it up.`,
          category: "positive",
          priority: 8,
          data: { recent_win_rate: recentWinRate.toFixed(0), older_win_rate: olderWinRate.toFixed(0), delta: winRateDelta.toFixed(0) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } else if (winRateDelta < -10) {
        insights.push({
          user_id,
          insight_type: "consistency",
          title: "Performance Declining",
          description: `Your win rate has dropped from ${olderWinRate.toFixed(0)}% to ${recentWinRate.toFixed(0)}% recently. Review your recent trades for pattern changes, and check if market conditions have shifted or if discipline has slipped.`,
          category: "warning",
          priority: 9,
          data: { recent_win_rate: recentWinRate.toFixed(0), older_win_rate: olderWinRate.toFixed(0), delta: winRateDelta.toFixed(0) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    const psychByDate: Record<string, any> = {};
    psychologyEntries.forEach((entry) => {
      const dateKey = (entry.entry_date || "").split("T")[0];
      if (dateKey) {
        psychByDate[dateKey] = {
          stress: entry.psychology_data?.stress_level || entry.stress_level || 0,
          mood: entry.psychology_data?.mood_rating || entry.mood_before || 0,
          confidence: entry.psychology_data?.confidence_level || entry.confidence_level,
          emotional_state: entry.psychology_data?.emotional_state || entry.mood || "",
        };
      }
    });

    const highStressTrades: number[] = [];
    const lowStressTrades: number[] = [];

    trades.forEach((t) => {
      const dateKey = getEntryDate(t).split("T")[0];
      const psych = psychByDate[dateKey];
      if (!psych) return;
      const pnl = getPnl(t);
      if (psych.stress >= 6) highStressTrades.push(pnl);
      else if (psych.stress > 0 && psych.stress <= 4) lowStressTrades.push(pnl);
    });

    if (highStressTrades.length >= 3 && lowStressTrades.length >= 3) {
      const highStressWinRate = (highStressTrades.filter((p) => p > 0).length / highStressTrades.length) * 100;
      const lowStressWinRate = (lowStressTrades.filter((p) => p > 0).length / lowStressTrades.length) * 100;

      if (lowStressWinRate - highStressWinRate > 15) {
        insights.push({
          user_id,
          insight_type: "psychology",
          title: "Stress Hurts Your Trading",
          description: `When calm (stress 1-4), your win rate is ${lowStressWinRate.toFixed(0)}%. When stressed (6+), it drops to ${highStressWinRate.toFixed(0)}%. Managing stress before trading could significantly improve your results.`,
          category: "warning",
          priority: 9,
          data: { high_stress_win_rate: highStressWinRate.toFixed(0), low_stress_win_rate: lowStressWinRate.toFixed(0), high_stress_count: highStressTrades.length, low_stress_count: lowStressTrades.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } else if (highStressWinRate >= lowStressWinRate) {
        insights.push({
          user_id,
          insight_type: "psychology",
          title: "Strong Under Pressure",
          description: `Your performance holds steady even under stress (${highStressWinRate.toFixed(0)}% vs ${lowStressWinRate.toFixed(0)}% when calm). That's unusual mental resilience -- a real edge.`,
          category: "positive",
          priority: 7,
          data: { high_stress_win_rate: highStressWinRate.toFixed(0), low_stress_win_rate: lowStressWinRate.toFixed(0) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    if (psychologyEntries.length >= 3) {
      const avgStress = psychologyEntries.reduce((s, e) => s + (e.psychology_data?.stress_level || e.stress_level || 0), 0) / psychologyEntries.length;
      const avgMood = psychologyEntries.reduce((s, e) => s + (e.psychology_data?.mood_rating || e.mood_before || 0), 0) / psychologyEntries.length;

      if (avgStress > 7) {
        insights.push({
          user_id,
          insight_type: "psychology",
          title: "Elevated Stress Levels",
          description: `Your average stress level is ${avgStress.toFixed(1)}/10. Consistent high stress degrades decision-making over time. Consider incorporating a pre-trade meditation or breathing routine.`,
          category: "critical",
          priority: 9,
          data: { avg_stress: avgStress.toFixed(1), entries: psychologyEntries.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      if (avgMood > 0 && avgMood < 4) {
        insights.push({
          user_id,
          insight_type: "psychology",
          title: "Low Mood Trend",
          description: `Your average mood rating is ${avgMood.toFixed(1)}/10 across recent entries. Low mood can lead to hesitation or revenge trading. Prioritize self-care and consider reducing trade size until your mindset stabilizes.`,
          category: "warning",
          priority: 8,
          data: { avg_mood: avgMood.toFixed(1), entries: psychologyEntries.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    if (tradingRules && tradingRules.length > 0 && trades.length >= 3) {
      const tradeIdSet = new Set(trades.map((t) => t.id));
      const relevantRules = entryRules.filter((er) => tradeIdSet.has(er.journal_entry_id));

      if (relevantRules.length > 0) {
        const followed = relevantRules.filter((er) => er.followed).length;
        const complianceRate = (followed / relevantRules.length) * 100;

        if (complianceRate >= 85) {
          insights.push({
            user_id,
            insight_type: "discipline",
            title: "Excellent Rule Compliance",
            description: `You're following your trading rules ${complianceRate.toFixed(0)}% of the time. This discipline is what separates consistent traders from the rest.`,
            category: "positive",
            priority: 8,
            data: { compliance_rate: complianceRate.toFixed(0), followed, total: relevantRules.length },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        } else if (complianceRate < 60) {
          insights.push({
            user_id,
            insight_type: "discipline",
            title: "Rule Compliance Needs Work",
            description: `You're only following your rules ${complianceRate.toFixed(0)}% of the time. Rules exist to protect you from impulsive decisions. Review them before each session and commit to sticking to your plan.`,
            category: "warning",
            priority: 9,
            data: { compliance_rate: complianceRate.toFixed(0), followed, total: relevantRules.length },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }

        const ruleBreakdown: Record<string, { name: string; followed: number; broken: number }> = {};
        tradingRules.forEach((r) => {
          ruleBreakdown[r.id] = { name: r.name || r.rule_text, followed: 0, broken: 0 };
        });
        relevantRules.forEach((er) => {
          if (ruleBreakdown[er.rule_id]) {
            if (er.followed) ruleBreakdown[er.rule_id].followed++;
            else ruleBreakdown[er.rule_id].broken++;
          }
        });

        const mostBroken = Object.values(ruleBreakdown)
          .filter((r) => r.broken >= 3 && r.broken > r.followed)
          .sort((a, b) => b.broken - a.broken)[0];

        if (mostBroken) {
          const total = mostBroken.followed + mostBroken.broken;
          const breakRate = ((mostBroken.broken / total) * 100).toFixed(0);
          insights.push({
            user_id,
            insight_type: "discipline",
            title: "Most Broken Rule",
            description: `"${mostBroken.name}" is broken ${breakRate}% of the time (${mostBroken.broken} out of ${total} trades). This specific rule needs extra focus. Consider writing it on a sticky note by your screen.`,
            category: "warning",
            priority: 8,
            data: { rule_name: mostBroken.name, break_rate: breakRate, broken: mostBroken.broken, total },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }
      }
    }

    const recentTenTrades = trades.slice(0, 10);
    let currentStreak = 0;
    let streakType: "win" | "loss" | null = null;

    for (const trade of recentTenTrades) {
      const pnl = getPnl(trade);
      if (streakType === null) {
        streakType = pnl > 0 ? "win" : "loss";
        currentStreak = 1;
      } else if ((pnl > 0 && streakType === "win") || (pnl <= 0 && streakType === "loss")) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak >= 5 && streakType === "win") {
      insights.push({
        user_id,
        insight_type: "pattern",
        title: "Winning Streak",
        description: `${currentStreak} consecutive wins. Stay grounded and don't let overconfidence increase your risk. Stick to your position sizing rules.`,
        category: "neutral",
        priority: 6,
        data: { streak: currentStreak },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else if (currentStreak >= 3 && streakType === "loss") {
      insights.push({
        user_id,
        insight_type: "risk",
        title: "Losing Streak Alert",
        description: `${currentStreak} consecutive losses. Consider stepping away from the screen, reviewing your recent setups, and returning with fresh eyes. Revenge trading will make this worse.`,
        category: "critical",
        priority: 10,
        data: { streak: currentStreak },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (trades.length >= 3 && tradingRules.length === 0 && psychologyEntries.length === 0) {
      insights.push({
        user_id,
        insight_type: "discipline",
        title: "Set Up Your Trading Framework",
        description: "You're logging trades but haven't defined trading rules or tracked your psychology yet. The best traders have clear rules and monitor their mental state. Set up your Trading Rules and start a Psychology Journal to unlock deeper insights from Nova.",
        category: "neutral",
        priority: 7,
        data: { has_rules: false, has_psychology: false },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else if (tradingRules.length === 0 && trades.length >= 5) {
      insights.push({
        user_id,
        insight_type: "discipline",
        title: "Define Your Trading Rules",
        description: "You have trades logged but no defined rules. Trading without rules is gambling. Go to your Trading Plan and define the rules you commit to following on every trade.",
        category: "warning",
        priority: 8,
        data: { has_rules: false },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (trades.length >= 5 && psychologyEntries.length === 0) {
      insights.push({
        user_id,
        insight_type: "psychology",
        title: "Start Tracking Your Psychology",
        description: "You have no psychology entries yet. Trading psychology is often the biggest edge. Start logging your emotional state before and after trades so Nova can correlate your mindset with performance.",
        category: "neutral",
        priority: 7,
        data: { has_psychology: false },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (force_refresh) {
      await supabaseClient
        .from("user_insights")
        .delete()
        .eq("user_id", user_id);
    }

    if (insights.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("user_insights")
        .insert(insights);

      if (insertError) {
        console.error("Error inserting insights:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ insights, cached: false, generated_count: insights.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-insights:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate insights", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
