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
      /*
        The broker-sourced columns are here for the execution analysis
        below. They are null on anything typed by hand or imported from a
        CSV, which is why that analysis reports on synced trades only rather
        than quietly averaging nulls in with real figures.
      */
      .select(
        "pnl, entry_date, exit_date, symbol, direction, quantity, quantity_unit, " +
        "pips, gain_percent, duration_minutes, close_reason, commission, swap, external_id"
      )
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
      psychChecksResult,
      entryPsychChecksResult,
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
      /*
        The pre-trade psychology checklist, fetched by user_id the same way
        rules and confluences are - so a trader renaming or adding a check is
        picked up on the next question, with nothing to keep in sync.
      */
      supabaseClient
        .from("psychology_checks")
        .select("id, name, description, enabled")
        .eq("user_id", user_id),
      supabaseClient
        .from("journal_entry_psychology_checks")
        .select("*, psychology_checks(id, name)")
        .eq("psychology_checks.user_id", user_id),
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
    const psychChecks = psychChecksResult.data || [];
    const entryPsychChecks = entryPsychChecksResult.data || [];
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

    /*
      Per-check honesty rate, mirroring rule compliance above.

      Confirmed and denied are counted separately and unanswered is ignored
      entirely - an untouched check means the trader said nothing, and folding
      that in as a "no" would invent an admission they never made.
    */
    const psychCheckStats: Record<string, { name: string; confirmed: number; denied: number; rate: number }> = {};
    psychChecks.forEach((c: any) => {
      psychCheckStats[c.id] = { name: c.name, confirmed: 0, denied: 0, rate: 0 };
    });

    entryPsychChecks.forEach((epc: any) => {
      if (!entryIdSet.has(epc.journal_entry_id)) return;
      const stat = psychCheckStats[epc.check_id];
      if (!stat) return;
      if (epc.confirmed === true) stat.confirmed++;
      else if (epc.confirmed === false) stat.denied++;
    });

    Object.values(psychCheckStats).forEach((stat) => {
      const answered = stat.confirmed + stat.denied;
      stat.rate = answered > 0 ? (stat.confirmed / answered) * 100 : 0;
    });

    /*
      The three pre-trade self-ratings, averaged, and split by whether the
      trade went on to win or lose - which is the comparison worth having.
      "You rate your focus lowest on the days you lose" is only sayable if
      the ratings are kept next to the outcomes.
    */
    const scaleBuckets = { wins: [] as any[], losses: [] as any[] };
    journalEntries.forEach((e: any) => {
      const pnl = Number(e.manual_pnl);
      if (!Number.isFinite(pnl) || pnl === 0) return;
      const rated = {
        emotional_state: e.pre_trade_emotional_state,
        focus: e.pre_trade_focus,
        confidence: e.pre_trade_confidence,
      };
      if (rated.emotional_state == null && rated.focus == null && rated.confidence == null) return;
      (pnl > 0 ? scaleBuckets.wins : scaleBuckets.losses).push(rated);
    });

    const averageScale = (rows: any[], key: string) => {
      const values = rows.map((r) => r[key]).filter((v) => typeof v === 'number');
      if (values.length === 0) return null;
      return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
    };

    const preTradeScales = {
      on_winning_trades: {
        sample: scaleBuckets.wins.length,
        emotional_state: averageScale(scaleBuckets.wins, 'emotional_state'),
        focus: averageScale(scaleBuckets.wins, 'focus'),
        confidence: averageScale(scaleBuckets.wins, 'confidence'),
      },
      on_losing_trades: {
        sample: scaleBuckets.losses.length,
        emotional_state: averageScale(scaleBuckets.losses, 'emotional_state'),
        focus: averageScale(scaleBuckets.losses, 'focus'),
        confidence: averageScale(scaleBuckets.losses, 'confidence'),
      },
    };

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


    /*
      What the broker recorded, as opposed to what the trader wrote down.

      Everything here comes from synced trades only. A hand-typed or
      CSV-imported trade has no close reason, no commission and no pip
      count, and averaging nulls in beside real figures would produce
      numbers that look authoritative and mean nothing. When there are no
      synced trades this whole section is null, which tells Nova to talk
      about the journal instead of inventing execution analysis.
    */
    const syncedTrades = (tradesResult.data || []).filter((t: any) => t.external_id);

    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const round2 = (n: number | null) =>
      n === null ? null : Math.round(n * 100) / 100;

    const byCloseReason: Record<string, any> = {};
    for (const t of syncedTrades) {
      const reason = t.close_reason ?? "unknown";
      const bucket = byCloseReason[reason] ??= { count: 0, pnl: [], pips: [], minutes: [] };
      bucket.count++;
      if (typeof t.pnl === "number") bucket.pnl.push(t.pnl);
      if (typeof t.pips === "number") bucket.pips.push(Math.abs(t.pips));
      if (typeof t.duration_minutes === "number") bucket.minutes.push(t.duration_minutes);
    }
    for (const key of Object.keys(byCloseReason)) {
      const b = byCloseReason[key];
      byCloseReason[key] = {
        count: b.count,
        share_of_trades: round2((b.count / syncedTrades.length) * 100),
        avg_pnl: round2(avg(b.pnl)),
        total_pnl: round2(b.pnl.reduce((a: number, c: number) => a + c, 0)),
        avg_pips_moved: round2(avg(b.pips)),
        avg_minutes_held: round2(avg(b.minutes)),
      };
    }

    /*
      Ordered oldest-first, because every sequential question below - did
      size go up after a loss, how long until the next trade - is about what
      came after what.
    */
    const inOrder = [...syncedTrades].sort(
      (a: any, b: any) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime(),
    );

    const sizeAfterLoss: number[] = [];
    const sizeAfterWin: number[] = [];
    const minutesToNextAfterLoss: number[] = [];
    const minutesToNextAfterWin: number[] = [];

    for (let i = 1; i < inOrder.length; i++) {
      const prev = inOrder[i - 1];
      const cur = inOrder[i];
      const lost = Number(prev.pnl ?? 0) < 0;

      if (typeof cur.quantity === "number") {
        (lost ? sizeAfterLoss : sizeAfterWin).push(cur.quantity);
      }
      /*
        Measured from the previous trade's close to this one's open: the
        gap between being hurt and acting again. Negative values mean the
        positions overlapped, which is a different behaviour and not a
        re-entry, so they are dropped rather than counted as zero.
      */
      const gap =
        (new Date(cur.entry_date).getTime() - new Date(prev.exit_date).getTime()) / 60000;
      if (Number.isFinite(gap) && gap >= 0) {
        (lost ? minutesToNextAfterLoss : minutesToNextAfterWin).push(gap);
      }
    }

    const commissionTotal = syncedTrades.reduce(
      (n: number, t: any) => n + Number(t.commission ?? 0), 0);
    const swapTotal = syncedTrades.reduce(
      (n: number, t: any) => n + Number(t.swap ?? 0), 0);
    const netTotal = syncedTrades.reduce(
      (n: number, t: any) => n + Number(t.pnl ?? 0), 0);
    const grossTotal = netTotal - commissionTotal - swapTotal;

    const execution = syncedTrades.length === 0 ? null : {
      synced_trades: syncedTrades.length,
      /*
        How trades ended, which is the only route to a stop or target from
        history: MetaTrader records neither on the entry order, so for a
        trade that closed at one, the exit price is where that level sat.
      */
      by_close_reason: byCloseReason,
      /*
        The comparison that exposes cutting winners and running losers.
        Stops are set once and hit at full distance; a manual exit is a
        decision made under pressure. When the manual number is well below
        the stop number, the trader is taking less on winners than they give
        up on losers, whatever their win rate says.
      */
      exit_discipline: {
        avg_pips_when_stopped: byCloseReason.stop_loss?.avg_pips_moved ?? null,
        avg_pips_when_target_hit: byCloseReason.take_profit?.avg_pips_moved ?? null,
        avg_pips_when_closed_manually: byCloseReason.manual?.avg_pips_moved ?? null,
      },
      /*
        Already inside pnl - the broker's profit is net. Here so the drag
        can be named: a strategy that is profitable gross and losing net is
        a specific, fixable problem, and it is invisible without this.
      */
      costs: {
        commission_total: round2(commissionTotal),
        swap_total: round2(swapTotal),
        net_pnl: round2(netTotal),
        gross_pnl_before_costs: round2(grossTotal),
        costs_as_pct_of_gross: grossTotal !== 0
          ? round2(Math.abs((commissionTotal + swapTotal) / grossTotal) * 100)
          : null,
      },
      hold_time_minutes: {
        average: round2(avg(syncedTrades
          .map((t: any) => t.duration_minutes)
          .filter((n: any) => typeof n === "number"))),
        winners: round2(avg(syncedTrades
          .filter((t: any) => Number(t.pnl ?? 0) > 0 && typeof t.duration_minutes === "number")
          .map((t: any) => t.duration_minutes))),
        losers: round2(avg(syncedTrades
          .filter((t: any) => Number(t.pnl ?? 0) < 0 && typeof t.duration_minutes === "number")
          .map((t: any) => t.duration_minutes))),
      },
      /*
        Tilt, stated as a measurement rather than a diagnosis. Sizing up
        after a loss is the classic tell, but it is also what a planned
        martingale looks like, so Nova is given the numbers and the trader
        is asked - never told - what they mean.
      */
      sizing: {
        unit: syncedTrades[0]?.quantity_unit ?? null,
        avg_size: round2(avg(syncedTrades
          .map((t: any) => t.quantity)
          .filter((n: any) => typeof n === "number"))),
        avg_size_after_a_loss: round2(avg(sizeAfterLoss)),
        avg_size_after_a_win: round2(avg(sizeAfterWin)),
      },
      /*
        Revenge trading: how quickly the next position goes on after a
        loss, against how quickly after a win. A large gap between the two
        is worth asking about.
      */
      re_entry_minutes: {
        after_a_loss: round2(avg(minutesToNextAfterLoss)),
        after_a_win: round2(avg(minutesToNextAfterWin)),
      },
      /*
        Risk actually taken, from the broker's own return-on-equity figure,
        which accounts for the balance at the time rather than today's.
      */
      risk: {
        avg_pct_of_equity_lost_when_stopped: round2(avg(syncedTrades
          .filter((t: any) => t.close_reason === "stop_loss" && typeof t.gain_percent === "number")
          .map((t: any) => Math.abs(t.gain_percent)))),
        worst_single_trade_pct_of_equity: round2(
          syncedTrades
            .filter((t: any) => typeof t.gain_percent === "number")
            .reduce((worst: number, t: any) =>
              Math.min(worst, t.gain_percent), 0),
        ),
      },
    };

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
      // The trader's own checklist, whatever they have named the items.
      psychology_checklist: psychCheckStats,
      pre_trade_scales: preTradeScales,
      /* Broker-sourced execution analysis; null with no synced trades. */
      execution,
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
