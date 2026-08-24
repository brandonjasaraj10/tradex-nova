import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateTipsRequest {
  force_refresh?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { force_refresh = false }: GenerateTipsRequest = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader ?? "" },
        },
      }
    );

    // Identity is derived from the verified JWT, never trusted from the
    // request body - same pattern as every other fix this session.
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "User authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user_id = authUser.id;

    if (!force_refresh) {
      const { data: existingTips } = await supabaseClient
        .from("user_tips")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_dismissed", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      if (existingTips && existingTips.length > 0) {
        const { data: allTips } = await supabaseClient
          .from("user_tips")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_dismissed", false)
          .gt("expires_at", new Date().toISOString())
          .order("priority", { ascending: false })
          .limit(10);

        return new Response(
          JSON.stringify({ tips: allTips, cached: true }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString();

    // journal_entries has no category column - "trade" entries are just
    // ones with manual_pnl set, same convention used everywhere else
    // this session (Dashboard, Analytics, generate-insights).
    const { data: journalEntries, error: journalError } = await supabaseClient
      .from("journal_entries")
      .select("*")
      .eq("user_id", user_id)
      .gte("entry_date", cutoffDateStr)
      .order("entry_date", { ascending: false });

    if (journalError) throw journalError;

    /*
      Nova's advice has to cover the same trades the rest of the app counts.

      This used to read journal_entries alone, so everything in the trades
      table - CSV imports, and anything a broker sync writes - was invisible
      to it. On a real test account that was 20 of 26 trades, and it showed:
      the page rendered a tip reading "your solid win rate shows you have an
      edge" computed from 3 journal entries at 66.7%, directly above a NOVA
      Score panel reporting the true figure over all 10 trades in range.
      Advice contradicting the numbers printed beside it is worse than no
      advice, because it puts both in doubt.

      Trades are mapped onto the journal shape (manual_pnl / entry_date)
      rather than the scoring code being taught about two shapes - every tip
      below reads only those two fields.
    */
    const { data: tradeRows, error: tradeError } = await supabaseClient
      .from("trades")
      .select("pnl, entry_date, symbol")
      .eq("user_id", user_id)
      .gte("entry_date", cutoffDateStr);

    if (tradeError) throw tradeError;

    const journalTrades = (journalEntries || [])
      .filter((e: any) => e.manual_pnl !== null && e.manual_pnl !== undefined);

    const importedTrades = (tradeRows || []).map((t: any) => ({
      manual_pnl: t.pnl,
      entry_date: t.entry_date,
      symbol: t.symbol,
    }));

    // Sorted newest-first because the "recent losses" tip below takes
    // trades.slice(0, 5) and relies on that order. Before the merge it came
    // free from the journal query's ORDER BY; concatenating two sources
    // silently broke it, which would have made a "take a break after
    // losses" tip fire off an arbitrary five trades rather than the latest.
    const trades = [...journalTrades, ...importedTrades].sort(
      (a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );

    const { data: tradingRules } = await supabaseClient
      .from("trading_rules")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);

    const { data: userProfile } = await supabaseClient
      .from("user_trading_profiles")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const tips = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (!trades || trades.length < 3) {
      tips.push({
        user_id,
        tip_category: "discipline",
        title: "Start Building Your Track Record",
        content: "Consistency is key in trading. Start by logging all your trades to identify patterns and improve decision-making.",
        icon_name: "Award",
        priority: 10,
        context_data: { trade_count: trades?.length || 0 },
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      tips.push({
        user_id,
        tip_category: "risk_management",
        title: "Define Your Risk First",
        content: "Before entering any trade, always define your risk. Never risk more than 1-2% of your account on a single trade.",
        icon_name: "Target",
        priority: 9,
        context_data: {},
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else {
      const winningTrades = trades.filter((t) => {
        const pnl = t.manual_pnl;
        return pnl && pnl > 0;
      });

      const losingTrades = trades.filter((t) => {
        const pnl = t.manual_pnl;
        return pnl && pnl < 0;
      });

      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

      if (winRate < 50 && trades.length >= 10) {
        tips.push({
          user_id,
          tip_category: "strategy",
          title: "Review Your Entry Criteria",
          content: "Your win rate suggests your entries need refinement. Focus on quality setups with multiple confluences before entering.",
          icon_name: "Target",
          priority: 9,
          context_data: { win_rate: winRate.toFixed(1) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } else if (winRate > 65) {
        tips.push({
          user_id,
          tip_category: "discipline",
          title: "Maintain Your Edge",
          content: "Your solid win rate shows you have an edge. Stay disciplined, stick to your process, and avoid overtrading.",
          icon_name: "Award",
          priority: 8,
          context_data: { win_rate: winRate.toFixed(1) },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      if (winningTrades.length > 0 && losingTrades.length > 0) {
        const avgWin = winningTrades.reduce((sum, t) => sum + (t.manual_pnl || 0), 0) / winningTrades.length;
        const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.manual_pnl || 0), 0) / losingTrades.length);

        if (avgLoss > 0 && avgWin / avgLoss < 1.5) {
          tips.push({
            user_id,
            tip_category: "risk_management",
            title: "Improve Your Risk-Reward",
            content: "Target at least 2:1 reward-to-risk ratio. Let winners run and cut losses early to improve profitability.",
            icon_name: "TrendingUp",
            priority: 9,
            context_data: { rr_ratio: (avgWin / avgLoss).toFixed(2) },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }
      }

      const recentTrades = trades.slice(0, 5);
      const recentLosses = recentTrades.filter((t) => (t.manual_pnl || 0) < 0).length;

      if (recentLosses >= 3) {
        tips.push({
          user_id,
          tip_category: "psychology",
          title: "Take a Break After Losses",
          content: "After a losing streak, step away to clear your head. Review what went wrong objectively before returning.",
          icon_name: "Brain",
          priority: 10,
          context_data: { recent_losses: recentLosses },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      if (tradingRules && tradingRules.length > 0) {
        let totalRuleChecks = 0;
        let rulesFollowed = 0;

        trades.forEach((t) => {
          const followed = t.rules_followed?.length || 0;
          const broken = t.rules_broken?.length || 0;
          totalRuleChecks += followed + broken;
          rulesFollowed += followed;
        });

        if (totalRuleChecks > 0) {
          const complianceRate = (rulesFollowed / totalRuleChecks) * 100;

          if (complianceRate < 70) {
            tips.push({
              user_id,
              tip_category: "discipline",
              title: "Follow Your Rules",
              content: "Your trading rules exist for a reason. Review them before each trade and commit to following them consistently.",
              icon_name: "CheckCircle2",
              priority: 9,
              context_data: { compliance_rate: complianceRate.toFixed(0) },
              generated_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
            });
          }
        }
      }

      const tradesThisWeek = trades.filter((t) => {
        const tradeDate = new Date(t.entry_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return tradeDate >= weekAgo;
      });

      if (tradesThisWeek.length > 15) {
        tips.push({
          user_id,
          tip_category: "discipline",
          title: "Quality Over Quantity",
          content: "You're taking many trades. Focus on fewer, higher-quality setups that meet all your criteria.",
          icon_name: "Target",
          priority: 8,
          context_data: { weekly_trades: tradesThisWeek.length },
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      // journal_entries has no session/time-of-day tracking field yet.
      const hasTimeData = false;
      if (!hasTimeData && trades.length >= 5) {
        tips.push({
          user_id,
          tip_category: "strategy",
          title: "Track Your Trading Sessions",
          content: "Start logging which market session you trade. This helps identify your best performing times.",
          icon_name: "Clock",
          priority: 6,
          context_data: {},
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      if (userProfile) {
        if (userProfile.trading_style === "scalper" || userProfile.trading_style === "day_trader") {
          tips.push({
            user_id,
            tip_category: "timing",
            title: "Trade During High Liquidity",
            content: "As a short-term trader, focus on major market overlaps when liquidity and volatility are highest.",
            icon_name: "Clock",
            priority: 7,
            context_data: { trading_style: userProfile.trading_style },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        } else if (userProfile.trading_style === "swing_trader") {
          tips.push({
            user_id,
            tip_category: "strategy",
            title: "Focus on Higher Timeframes",
            content: "Swing traders benefit from 4H and daily charts. Don't let lower timeframe noise distract you.",
            icon_name: "TrendingUp",
            priority: 7,
            context_data: { trading_style: userProfile.trading_style },
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }
      }
    }

    if (tips.length === 0) {
      tips.push({
        user_id,
        tip_category: "discipline",
        title: "Stay Consistent",
        content: "Consistency beats perfection. Stick to your trading plan and trust your confluences.",
        icon_name: "Award",
        priority: 7,
        context_data: {},
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      tips.push({
        user_id,
        tip_category: "risk_management",
        title: "Protect Your Capital",
        content: "Always define your risk before entering a trade. Capital preservation is the foundation of success.",
        icon_name: "Target",
        priority: 7,
        context_data: {},
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    if (force_refresh) {
      await supabaseClient
        .from("user_tips")
        .delete()
        .eq("user_id", user_id);
    }

    if (tips.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("user_tips")
        .insert(tips);

      if (insertError) {
        console.error("Error inserting tips:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        tips,
        cached: false,
        generated_count: tips.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-tips:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate tips",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
