import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { clientSafeMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateReportRequest {
  user_id: string;
  report_type: "weekly" | "monthly" | "quarterly" | "yearly";
  period_start: string;
  period_end: string;
  force_refresh?: boolean;
  // null/absent means "All Accounts"; an id scopes the report to one account.
  account_id?: string | null;
}

interface UnifiedTrade {
  pnl: number;
  symbol: string;
  direction: string;
  entry_date: string;
  exit_date: string | null;
  source: "trades" | "journal";
  journal_entry_id?: string;
}

function getSession(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const hour = date.getUTCHours();
    if (hour >= 0 && hour < 8) return "Asia";
    if (hour >= 8 && hour < 13) return "London";
    if (hour >= 13 && hour < 22) return "New York";
    return "Other";
  } catch {
    return "Unknown";
  }
}

function parseDurationMinutes(duration: string | null): number {
  if (!duration) return 0;
  const str = duration.toLowerCase().trim();
  let minutes = 0;
  const hourMatch = str.match(/(\d+)\s*h/);
  const minMatch = str.match(/(\d+)\s*m/);
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);
  if (minutes === 0) {
    const numOnly = parseFloat(str);
    if (!isNaN(numOnly)) minutes = numOnly;
  }
  return minutes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      report_type,
      period_start,
      period_end,
      force_refresh = false,
      account_id = null,
    }: GenerateReportRequest = await req.json();

    if (!report_type || !period_start || !period_end) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Identity is derived from the verified JWT, never trusted from the
    // request body - same pattern as every other fix this session.
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "User authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user_id = authUser.id;

    if (!force_refresh) {
      /*
        The cache is keyed (user_id, report_type, period_start) with no
        account dimension, so a report generated while one account was
        selected would be served for every other account too. Until that
        key changes, only cache the all-accounts view and always compute a
        per-account report fresh - stale-but-shared numbers are worse than
        recomputing.
      */
      const { data: existing } = account_id
        ? { data: null }
        : await supabase
            .from("trading_reports")
            .select("*")
            .eq("user_id", user_id)
            .eq("report_type", report_type)
            .eq("period_start", period_start)
            .maybeSingle();

      if (existing) {
        const report = mapDbToReport(existing);
        return new Response(
          JSON.stringify({ report, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const periodEndPlusOne = new Date(period_end);
    periodEndPlusOne.setDate(periodEndPlusOne.getDate() + 1);
    const periodEndStr = periodEndPlusOne.toISOString();

    /*
      Scope to the selected account.

      Both queries filtered on user_id alone, so every report summed every
      account together regardless of which one was selected - a trader
      running a funded account alongside a personal one saw one blended
      number in the weekly cards and in the dashboard reports. Confirmed on
      a two-account test user: $1,000 on one account and $9,999 on another
      reported as $10,999 for either.

      Trades attach to an account by broker_id, journal entries by
      account_id, matching how every other feature joins them. With no
      account_id the behaviour is unchanged, which is what "All Accounts"
      wants.
    */
    let tradesQuery = supabase
      .from("trades")
      .select("pnl, symbol, direction, entry_date, exit_date")
      .eq("user_id", user_id)
      .gte("entry_date", period_start)
      .lt("entry_date", periodEndStr)
      .order("entry_date", { ascending: true });

    let journalQuery = supabase
      .from("journal_entries")
      .select("id, manual_pnl, symbol, entry_date, template_data, trade_duration")
      .eq("user_id", user_id)
      .not("manual_pnl", "is", null)
      .gte("entry_date", period_start)
      .lte("entry_date", period_end)
      .order("entry_date", { ascending: true });

    if (account_id) {
      tradesQuery = tradesQuery.eq("broker_id", account_id);
      journalQuery = journalQuery.eq("account_id", account_id);
    }

    const [tradesResult, journalResult] = await Promise.all([tradesQuery, journalQuery]);

    const allTrades: UnifiedTrade[] = [];

    (tradesResult.data || []).forEach((t: any) => {
      allTrades.push({
        pnl: t.pnl || 0,
        symbol: t.symbol || "Unknown",
        direction: t.direction || "LONG",
        entry_date: t.entry_date,
        exit_date: t.exit_date,
        source: "trades",
      });
    });

    const journalEntryIds: string[] = [];
    (journalResult.data || [])
      .forEach((e: any) => {
        allTrades.push({
          pnl: e.manual_pnl || 0,
          symbol: e.symbol || "Unknown",
          direction: "LONG",
          entry_date: e.entry_date,
          exit_date: e.entry_date,
          source: "journal",
          journal_entry_id: e.id,
        });
        journalEntryIds.push(e.id);
      });

    const emptyInsights = [
      { type: "info", message: "No trading activity during this period" },
    ];

    if (allTrades.length === 0) {
      const report = buildEmptyReport(
        user_id,
        report_type,
        period_start,
        period_end,
        emptyInsights
      );
      const saved = await saveReport(
        supabase,
        report,
        user_id,
        report_type,
        period_start,
        period_end,
        force_refresh,
        account_id
      );
      return new Response(
        JSON.stringify({ report: saved, cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const winningTrades = allTrades.filter((t) => t.pnl > 0);
    const losingTrades = allTrades.filter((t) => t.pnl < 0);
    const totalPnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate =
      allTrades.length > 0
        ? (winningTrades.length / allTrades.length) * 100
        : 0;

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length
        : 0;
    const avgLoss =
      losingTrades.length > 0
        ? Math.abs(
            losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length
          )
        : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const bestTrade = Math.max(...allTrades.map((t) => t.pnl));
    const worstTrade = Math.min(...allTrades.map((t) => t.pnl));

    let currentStreak = 0;
    let largestWinStreak = 0;
    let largestLossStreak = 0;
    let currentStreakType: "win" | "loss" | null = null;

    allTrades.forEach((trade) => {
      const isWin = trade.pnl > 0;
      if (
        currentStreakType === null ||
        (isWin && currentStreakType === "win") ||
        (!isWin && currentStreakType === "loss")
      ) {
        currentStreak++;
        currentStreakType = isWin ? "win" : "loss";
      } else {
        if (currentStreakType === "win")
          largestWinStreak = Math.max(largestWinStreak, currentStreak);
        else largestLossStreak = Math.max(largestLossStreak, currentStreak);
        currentStreak = 1;
        currentStreakType = isWin ? "win" : "loss";
      }
    });
    if (currentStreakType === "win")
      largestWinStreak = Math.max(largestWinStreak, currentStreak);
    else if (currentStreakType === "loss")
      largestLossStreak = Math.max(largestLossStreak, currentStreak);

    const pairCounts: Record<string, number> = {};
    allTrades.forEach((t) => {
      pairCounts[t.symbol] = (pairCounts[t.symbol] || 0) + 1;
    });
    const mostTradedPairs = Object.entries(pairCounts)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sessionCounts: Record<string, { trades: number; pnl: number }> = {};
    allTrades.forEach((t) => {
      const session = getSession(t.entry_date);
      if (!sessionCounts[session])
        sessionCounts[session] = { trades: 0, pnl: 0 };
      sessionCounts[session].trades++;
      sessionCounts[session].pnl += t.pnl;
    });

    let avgTradeDuration = 0;
    const journalEntries = journalResult.data || [];
    const durEntries = journalEntries.filter(
      (e: any) => e.trade_duration
    );
    if (durEntries.length > 0) {
      const totalMin = durEntries.reduce(
        (s: number, e: any) => s + parseDurationMinutes(e.trade_duration),
        0
      );
      avgTradeDuration = totalMin / durEntries.length;
    }

    let ruleComplianceRate = 0;
    if (journalEntryIds.length > 0) {
      const { data: ruleData } = await supabase
        .from("journal_entry_rules")
        .select("followed")
        .in("journal_entry_id", journalEntryIds);

      if (ruleData && ruleData.length > 0) {
        const followed = ruleData.filter((r: any) => r.followed === true).length;
        ruleComplianceRate = (followed / ruleData.length) * 100;
      }
    }

    let avgPsychologyScore = 0;
    const psychEntries = journalEntries.filter((e: any) => {
      const td = e.template_data;
      return td?.end_of_day_summary?.nova_score != null;
    });
    if (psychEntries.length > 0) {
      const totalScore = psychEntries.reduce(
        (s: number, e: any) =>
          s + (e.template_data?.end_of_day_summary?.nova_score || 0),
        0
      );
      avgPsychologyScore = totalScore / psychEntries.length;
    }

    const dailyPnl: Record<string, number> = {};
    allTrades.forEach((t) => {
      const date = (t.entry_date || "").split("T")[0];
      if (date) dailyPnl[date] = (dailyPnl[date] || 0) + t.pnl;
    });

    let bestDay: string | null = null;
    let bestDayPnl = -Infinity;
    let worstDay: string | null = null;
    let worstDayPnl = Infinity;

    Object.entries(dailyPnl).forEach(([date, pnl]) => {
      if (pnl > bestDayPnl) {
        bestDayPnl = pnl;
        bestDay = date;
      }
      if (pnl < worstDayPnl) {
        worstDayPnl = pnl;
        worstDay = date;
      }
    });

    const totalTradingDays = Object.keys(dailyPnl).length;

    const keyInsights: Array<{ type: string; message: string }> = [];

    if (winRate >= 65) {
      keyInsights.push({
        type: "positive",
        message: `Strong win rate of ${winRate.toFixed(1)}% shows consistent edge`,
      });
    } else if (winRate >= 50) {
      keyInsights.push({
        type: "neutral",
        message: `Win rate of ${winRate.toFixed(1)}% - solid foundation to build on`,
      });
    } else if (allTrades.length >= 5) {
      keyInsights.push({
        type: "warning",
        message: `Win rate of ${winRate.toFixed(1)}% suggests need for strategy refinement`,
      });
    }

    if (riskRewardRatio >= 2) {
      keyInsights.push({
        type: "positive",
        message: `Excellent risk-reward ratio of ${riskRewardRatio.toFixed(2)}:1`,
      });
    } else if (riskRewardRatio >= 1 && losingTrades.length > 0) {
      keyInsights.push({
        type: "neutral",
        message: `Risk-reward ratio of ${riskRewardRatio.toFixed(2)}:1 - aim for 2:1+`,
      });
    } else if (riskRewardRatio < 1 && losingTrades.length > 0) {
      keyInsights.push({
        type: "warning",
        message: `Risk-reward ratio of ${riskRewardRatio.toFixed(2)}:1 needs improvement`,
      });
    }

    if (totalPnl > 0) {
      keyInsights.push({
        type: "positive",
        message: `Profitable period with $${totalPnl.toFixed(2)} total gain`,
      });
    } else if (totalPnl < 0) {
      keyInsights.push({
        type: "critical",
        message: `Period closed at -$${Math.abs(totalPnl).toFixed(2)}. Review and adjust`,
      });
    }

    if (ruleComplianceRate >= 80) {
      keyInsights.push({
        type: "positive",
        message: `High rule compliance at ${ruleComplianceRate.toFixed(0)}%`,
      });
    } else if (ruleComplianceRate > 0 && ruleComplianceRate < 70) {
      keyInsights.push({
        type: "warning",
        message: `Rule compliance at ${ruleComplianceRate.toFixed(0)}%. Focus on discipline`,
      });
    }

    if (largestLossStreak >= 5) {
      keyInsights.push({
        type: "critical",
        message: `Experienced ${largestLossStreak} consecutive losses. Review trading conditions`,
      });
    }

    if (
      mostTradedPairs.length > 0 &&
      mostTradedPairs[0].count >= allTrades.length * 0.4
    ) {
      keyInsights.push({
        type: "neutral",
        message: `Heavy concentration on ${mostTradedPairs[0].pair} (${mostTradedPairs[0].count} trades)`,
      });
    }

    if (avgPsychologyScore > 0) {
      if (avgPsychologyScore >= 75) {
        keyInsights.push({
          type: "positive",
          message: `Strong psychological discipline with avg score of ${avgPsychologyScore.toFixed(0)}/100`,
        });
      } else if (avgPsychologyScore < 50) {
        keyInsights.push({
          type: "warning",
          message: `Psychology score averaging ${avgPsychologyScore.toFixed(0)}/100. Focus on mental game`,
        });
      }
    }

    if (keyInsights.length === 0) {
      keyInsights.push({
        type: "neutral",
        message: "Continue tracking for more detailed insights",
      });
    }

    const report = {
      user_id,
      report_type,
      period_start,
      period_end,
      total_trades: allTrades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: winRate,
      total_pnl: totalPnl,
      avg_win: avgWin,
      avg_loss: avgLoss,
      risk_reward_ratio: riskRewardRatio,
      best_trade: bestTrade,
      worst_trade: worstTrade,
      largest_win_streak: largestWinStreak,
      largest_loss_streak: largestLossStreak,
      most_traded_pairs: mostTradedPairs,
      session_breakdown: sessionCounts,
      avg_trade_duration: avgTradeDuration,
      rule_compliance_rate: ruleComplianceRate,
      avg_psychology_score: avgPsychologyScore,
      best_trading_day: bestDay,
      worst_trading_day: worstDay,
      total_trading_days: totalTradingDays,
      key_insights: keyInsights,
      generated_at: new Date().toISOString(),
      is_stale: false,
    };

    const saved = await saveReport(
      supabase,
      report,
      user_id,
      report_type,
      period_start,
      period_end,
      force_refresh,
      account_id
    );

    return new Response(JSON.stringify({ report: saved, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-report:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate report", details: clientSafeMessage(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildEmptyReport(
  user_id: string,
  report_type: string,
  period_start: string,
  period_end: string,
  insights: Array<{ type: string; message: string }>
) {
  return {
    user_id,
    report_type,
    period_start,
    period_end,
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    win_rate: 0,
    total_pnl: 0,
    avg_win: 0,
    avg_loss: 0,
    risk_reward_ratio: 0,
    best_trade: 0,
    worst_trade: 0,
    largest_win_streak: 0,
    largest_loss_streak: 0,
    most_traded_pairs: [],
    session_breakdown: {},
    avg_trade_duration: 0,
    rule_compliance_rate: 0,
    avg_psychology_score: 0,
    best_trading_day: null,
    worst_trading_day: null,
    total_trading_days: 0,
    key_insights: insights,
    generated_at: new Date().toISOString(),
    is_stale: false,
  };
}

async function saveReport(
  supabase: any,
  report: any,
  user_id: string,
  report_type: string,
  period_start: string,
  period_end: string,
  force_refresh: boolean,
  account_id?: string | null
) {
  /*
    Never persist a per-account report. trading_reports is unique on
    (user_id, report_type, period_start) with no account column, so writing
    one account's figures there would hand them to every other account and
    to the all-accounts view. Per-account reports are returned straight to
    the caller instead; only the all-accounts report is cached.
  */
  if (account_id) {
    return report;
  }

  const summary = {
    total_trades: report.total_trades,
    winning_trades: report.winning_trades,
    losing_trades: report.losing_trades,
    win_rate: report.win_rate,
    total_pnl: report.total_pnl,
    avg_win: report.avg_win,
    avg_loss: report.avg_loss,
    risk_reward_ratio: report.risk_reward_ratio,
    best_trade: report.best_trade,
    worst_trade: report.worst_trade,
    largest_win_streak: report.largest_win_streak,
    largest_loss_streak: report.largest_loss_streak,
    best_trading_day: report.best_trading_day,
    worst_trading_day: report.worst_trading_day,
    total_trading_days: report.total_trading_days,
    generated_at: report.generated_at,
    is_stale: report.is_stale,
  };

  const metrics = {
    most_traded_pairs: report.most_traded_pairs,
    session_breakdown: report.session_breakdown,
    avg_trade_duration: report.avg_trade_duration,
    rule_compliance_rate: report.rule_compliance_rate,
    avg_psychology_score: report.avg_psychology_score,
    key_insights: report.key_insights,
  };

  if (force_refresh) {
    await supabase
      .from("trading_reports")
      .delete()
      .eq("user_id", user_id)
      .eq("report_type", report_type)
      .eq("period_start", period_start);
  }

  const { data: existing } = await supabase
    .from("trading_reports")
    .select("id")
    .eq("user_id", user_id)
    .eq("report_type", report_type)
    .eq("period_start", period_start)
    .maybeSingle();

  let savedRow;
  if (existing) {
    const { data } = await supabase
      .from("trading_reports")
      .update({ summary, metrics, period_end })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    savedRow = data;
  } else {
    const { data } = await supabase
      .from("trading_reports")
      .insert({ user_id, report_type, period_start, period_end, summary, metrics })
      .select()
      .maybeSingle();
    savedRow = data;
  }

  return savedRow ? mapDbToReport(savedRow) : report;
}

function mapDbToReport(row: any) {
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
    key_insights: m.key_insights ?? [
      { type: "neutral", message: "Continue tracking for more insights" },
    ],
    generated_at: s.generated_at ?? row.created_at,
    is_stale: s.is_stale ?? false,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}
