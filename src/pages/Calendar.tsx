import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, DollarSign, Brain, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAccount } from '../lib/accountContext';
import { useDataSync } from '../lib/dataSync';
import { generateReport, getWeeklyReports, getMonthBasedWeekBounds, getMonthWeeks, type TradingReport } from '../services/reports';
import WeeklySummaryCard from '../components/reports/WeeklySummaryCard';
import TradingReportModal from '../components/reports/TradingReportModal';

interface DayData {
  date: string;
  pnl: number;
  tradeCount: number;
  psychologyScore: number | null;
  hasJournal: boolean;
}

type ViewMode = 'pnl' | 'psychology';

// A date-only string (like a `date` column, or `.toISOString().split('T')[0]`)
// always represents midnight UTC when parsed via `new Date(str)`, and
// `.toISOString()` always converts back to UTC - either one alone is fine,
// but round-tripping through them to get a *local* calendar day shifts the
// day by one for anyone west of UTC. This reads the local Y/M/D directly,
// no UTC conversion involved.
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Calendar() {
  const { user } = useAuth();
  const { selectedAccount } = useAccount();
  const { refreshTrigger } = useDataSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, DayData>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('pnl');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<TradingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<TradingReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (user) {
      loadCalendarData();
      loadWeeklyReportsForMonth();
    }
  }, [user, selectedAccount, currentDate, refreshTrigger]);

  const loadCalendarData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('exit_date', startOfMonth.toISOString())
        .lte('exit_date', endOfMonth.toISOString())
        .not('exit_date', 'is', null);

      if (selectedAccount) {
        query = query.eq('broker_id', selectedAccount.id);
      }

      const { data: trades, error: tradesError } = await query;

      if (tradesError) throw tradesError;

      const { data: journals, error: journalsError } = await supabase
        .from('journal_entries')
        .select('entry_date, template_data')
        .eq('user_id', user.id)
        .gte('entry_date', toLocalDateStr(startOfMonth))
        .lte('entry_date', toLocalDateStr(endOfMonth));

      if (journalsError) throw journalsError;

      const dataMap = new Map<string, DayData>();

      if (trades && trades.length > 0) {
        trades.forEach(trade => {
          if (!trade.exit_date) return;

          const dateKey = toLocalDateStr(new Date(trade.exit_date));
          const existing = dataMap.get(dateKey);

          if (existing) {
            existing.pnl += trade.pnl || 0;
            existing.tradeCount += 1;
          } else {
            dataMap.set(dateKey, {
              date: dateKey,
              pnl: trade.pnl || 0,
              tradeCount: 1,
              psychologyScore: null,
              hasJournal: false
            });
          }
        });
      }

      if (journals && journals.length > 0) {
        journals.forEach(journal => {
          const dateKey = journal.entry_date;
          const existing = dataMap.get(dateKey);

          let psychScore = null;
          if (journal.template_data) {
            const template = typeof journal.template_data === 'string'
              ? JSON.parse(journal.template_data)
              : journal.template_data;
            psychScore = template?.end_of_day_summary?.nova_score || null;
          }

          if (existing) {
            existing.psychologyScore = psychScore;
            existing.hasJournal = true;
          } else {
            dataMap.set(dateKey, {
              date: dateKey,
              pnl: 0,
              tradeCount: 0,
              psychologyScore: psychScore,
              hasJournal: true
            });
          }
        });
      }

      setCalendarData(dataMap);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setCalendarData(new Map());
    } finally {
      setLoading(false);
    }
  };

  const buildEmptyWeeklyReport = (weekStart: string, weekEnd: string): TradingReport => ({
    id: `empty-${weekStart}`,
    user_id: user?.id || '',
    report_type: 'weekly',
    period_start: weekStart,
    period_end: weekEnd,
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
    key_insights: [{ type: 'info', message: 'No trading activity during this period' }],
    generated_at: new Date().toISOString(),
    is_stale: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const loadWeeklyReportsForMonth = async () => {
    if (!user) return;

    setLoadingReports(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const weeks = getMonthWeeks(year, month);

      const savedReports = await getWeeklyReports(user.id, weeks[0].start, weeks[weeks.length - 1].end);

      const reports: TradingReport[] = [];
      for (const week of weeks) {
        const existing = savedReports.find(r => r.period_start === week.start);
        if (existing) {
          reports.push(existing);
        } else {
          try {
            const report = await generateReport(user.id, 'weekly', week.start, week.end, false);
            reports.push(report && report.total_trades !== undefined ? report : buildEmptyWeeklyReport(week.start, week.end));
          } catch (reportError) {
            console.error('Error generating weekly report:', reportError);
            reports.push(buildEmptyWeeklyReport(week.start, week.end));
          }
        }
      }

      setWeeklyReports(reports.sort((a, b) => b.period_start.localeCompare(a.period_start)));
    } catch (error) {
      console.error('Error loading weekly reports:', error);
      const weeks = getMonthWeeks(currentDate.getFullYear(), currentDate.getMonth());
      const emptyReports = weeks.map(week => buildEmptyWeeklyReport(week.start, week.end));
      setWeeklyReports(emptyReports.sort((a, b) => b.period_start.localeCompare(a.period_start)));
    } finally {
      setLoadingReports(false);
    }
  };

  const handleOpenReport = (report: TradingReport) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getPsychologyGradient = (score: number) => {
    if (score >= 90) return 'bg-gradient-to-br from-blue-500/40 via-blue-400/30 to-blue-600/25 border-blue-400/60 shadow-lg shadow-blue-500/20';
    if (score >= 80) return 'bg-gradient-to-br from-blue-400/35 via-blue-500/25 to-blue-600/20 border-blue-400/50 shadow-md shadow-blue-500/15';
    if (score >= 70) return 'bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/15 border-blue-400/40 shadow-md shadow-blue-500/10';
    if (score >= 60) return 'bg-gradient-to-br from-blue-400/25 via-blue-500/15 to-blue-600/10 border-blue-400/35 shadow-sm shadow-blue-500/5';
    if (score >= 50) return 'bg-gradient-to-br from-slate-500/20 via-gray-600/12 to-zinc-600/10 border-slate-500/30';
    if (score >= 40) return 'bg-gradient-to-br from-slate-400/20 via-gray-500/15 to-zinc-500/10 border-slate-400/30';
    if (score >= 30) return 'bg-gradient-to-br from-slate-500/18 via-gray-600/12 to-zinc-600/8 border-slate-500/25';
    return 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/30';
  };

  const getCellColor = (dayData: DayData | undefined) => {
    if (!dayData) return 'bg-white/[0.03] border-white/10';

    if (viewMode === 'pnl') {
      if (dayData.tradeCount === 0) return 'bg-white/[0.03] border-white/10';
      if (dayData.pnl > 0) return 'bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/15 border-blue-400/40 shadow-md shadow-blue-500/10';
      if (dayData.pnl < 0) return 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/40 shadow-sm shadow-slate-500/5';
      return 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/40 shadow-sm shadow-slate-500/5';
    } else {
      if (!dayData.hasJournal || dayData.psychologyScore === null) {
        if (dayData.tradeCount > 0) {
          return 'bg-white/5 border-blue-400/70 shadow-lg shadow-blue-500/40';
        }
        return 'bg-white/[0.03] border-white/10';
      }
      return getPsychologyGradient(dayData.psychologyScore);
    }
  };

  const getPsychologyTextColor = (score: number) => {
    if (score >= 90) return 'text-blue-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 50) return 'text-slate-300';
    if (score >= 40) return 'text-slate-300';
    if (score >= 30) return 'text-slate-300';
    return 'text-slate-300';
  };

  const getPsychologyMood = (score: number) => {
    if (score >= 90) return { text: 'Peak Performance', color: 'text-blue-400', bg: 'bg-blue-500/15' };
    if (score >= 80) return { text: 'Exceptional', color: 'text-blue-400', bg: 'bg-blue-500/12' };
    if (score >= 70) return { text: 'Strong Mind', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (score >= 60) return { text: 'Solid State', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (score >= 50) return { text: 'Balanced', color: 'text-slate-300', bg: 'bg-slate-500/10' };
    if (score >= 40) return { text: 'Wavering', color: 'text-slate-300', bg: 'bg-slate-500/10' };
    if (score >= 30) return { text: 'Under Pressure', color: 'text-slate-300', bg: 'bg-slate-500/10' };
    return { text: 'Critical', color: 'text-slate-300', bg: 'bg-slate-500/10' };
  };

  const getCellTextColor = (dayData: DayData | undefined) => {
    if (!dayData) return 'text-gray-400';

    if (viewMode === 'pnl') {
      if (dayData.tradeCount === 0) return 'text-gray-400';
      if (dayData.pnl > 0) return 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]';
      if (dayData.pnl < 0) return 'text-slate-300';
      return 'text-slate-300';
    } else {
      if (!dayData.hasJournal || dayData.psychologyScore === null) return 'text-gray-400';
      return getPsychologyTextColor(dayData.psychologyScore);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const totalDays = daysInMonth + startingDayOfWeek;
  const rows = Math.ceil(totalDays / 7);

  const getWeekReportForDate = (dateStr: string): TradingReport | null => {
    const date = new Date(dateStr);
    const weekBounds = getMonthBasedWeekBounds(date);
    return weeklyReports.find(r => r.period_start === weekBounds.start) || null;
  };

  const renderCalendar = () => {
    const cells = [];
    let currentDay = 1;
    const weekReportRows = new Map<number, string>();

    // First pass: determine which rows should have week reports
    let tempDay = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;
        if (cellIndex >= startingDayOfWeek && tempDay <= daysInMonth) {
          // Check if this is the end of a month-based week
          if (tempDay === 7 || tempDay === 14 || tempDay === 21 || tempDay === daysInMonth) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(tempDay).padStart(2, '0')}`;
            weekReportRows.set(row, dateKey);
          }
          tempDay++;
        }
      }
    }

    // Second pass: render the calendar
    currentDay = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;

        if (cellIndex < startingDayOfWeek || currentDay > daysInMonth) {
          cells.push(
            <div key={`empty-${row}-${col}`} className="w-full h-full border border-white/10 bg-white/[0.03] rounded-md transition-all duration-300" />
          );
        } else {
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          const dayData = calendarData.get(dateKey);
          const isToday = dateKey === toLocalDateStr(new Date());
          const dayOfWeek = new Date(year, month, currentDay).getDay();

          const isHovered = hoveredDay === dateKey;
          const mood = dayData && dayData.psychologyScore !== null && viewMode === 'psychology'
            ? getPsychologyMood(dayData.psychologyScore)
            : null;

          cells.push(
            <div key={currentDay} className="relative group w-full h-full">
              <button
                onClick={() => setSelectedDay(dayData || null)}
                onMouseEnter={() => setHoveredDay(dateKey)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-full h-full border transition-all duration-300 p-1 lg:p-2 flex flex-col justify-between relative rounded-md ${
                  getCellColor(dayData)
                } ${isToday ? 'ring-1 lg:ring-2 ring-blue-500/50' : ''}
                ${isHovered ? 'scale-105 shadow-lg hover:border-white/30' : 'hover:border-white/20'}
                ${viewMode === 'psychology' && dayData?.psychologyScore !== null ? 'hover:scale-105' : ''}`}
              >
                <div className={`text-[11px] lg:text-xs xl:text-sm font-semibold ${getCellTextColor(dayData)}`}>
                  {currentDay}
                </div>

                {dayData && viewMode === 'pnl' && dayData.tradeCount > 0 && (
                  <div className="text-center">
                    <div className={`text-[9px] lg:text-[10px] xl:text-xs ${getCellTextColor(dayData)}`}>
                      {dayData.tradeCount} {dayData.tradeCount === 1 ? 't' : 't'}
                    </div>
                    {!privacyMode && (
                      <div className={`text-[9px] lg:text-[10px] xl:text-xs font-bold ${getCellTextColor(dayData)}`}>
                        {dayData.pnl >= 0 ? '+' : '-'}${Math.abs(dayData.pnl).toFixed(0)}
                      </div>
                    )}
                    {privacyMode && dayData.pnl !== 0 && (
                      <div className="flex justify-center">
                        {dayData.pnl > 0 ? (
                          <TrendingUp size={10} className="text-blue-400" />
                        ) : (
                          <TrendingDown size={10} className="text-slate-300" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {dayData && viewMode === 'psychology' && dayData.hasJournal && (
                  <div className="text-center relative">
                    {dayData.psychologyScore !== null ? (
                      <>
                        <div className="relative">
                          <div className={`text-[11px] lg:text-xs xl:text-sm font-bold transition-all duration-300 ${getCellTextColor(dayData)} ${isHovered ? 'scale-125 drop-shadow-lg' : ''}`}>
                            {dayData.psychologyScore}
                          </div>
                          {isHovered && dayData.psychologyScore >= 70 && (
                            <div className="absolute inset-0 animate-ping opacity-30">
                              <div className={`text-[11px] lg:text-xs xl:text-sm font-bold ${getCellTextColor(dayData)}`}>
                                {dayData.psychologyScore}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-[8px] lg:text-[9px] xl:text-[10px] text-gray-400 mt-0.5">NOVA</div>
                      </>
                    ) : (
                      <div className="text-[9px] lg:text-[10px] text-gray-400">Journal</div>
                    )}
                  </div>
                )}

                {isToday && (
                  <div className="absolute bottom-0.5 right-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </button>

              {mood && isHovered && (
                <div className="absolute -top-11 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                  <div className={`${mood.bg} backdrop-blur-xl border ${mood.color.replace('text-', 'border-')}/20 rounded-lg px-4 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-semibold ${mood.color}`}>{mood.text}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 font-medium">Score</span>
                        <span className={`text-sm font-bold ${mood.color}`}>{dayData.psychologyScore}</span>
                      </div>
                    </div>
                    <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 ${mood.bg} border-r border-b ${mood.color.replace('text-', 'border-')}/20 rotate-45`} />
                  </div>
                </div>
              )}
            </div>
          );
          currentDay++;
        }
      }

      // Add the weekly report card in the 8th column
      const weekEndDateKey = weekReportRows.get(row);
      if (weekEndDateKey) {
        const weekReport = getWeekReportForDate(weekEndDateKey);
        if (weekReport) {
          cells.push(
            <div key={`report-${row}`} className="w-full h-full">
              <WeeklySummaryCard
                report={weekReport}
                onClick={() => handleOpenReport(weekReport)}
                privacyMode={privacyMode}
                delay={row}
              />
            </div>
          );
        } else {
          cells.push(
            <div key={`empty-report-${row}`} className="w-full h-full" />
          );
        }
      } else {
        cells.push(
          <div key={`empty-report-${row}`} className="w-full h-full" />
        );
      }
    }

    return cells;
  };

  const monthStats = Array.from(calendarData.values()).reduce(
    (acc, day) => ({
      totalPnl: acc.totalPnl + day.pnl,
      totalTrades: acc.totalTrades + day.tradeCount,
      winningDays: acc.winningDays + (day.pnl > 0 ? 1 : 0),
      losingDays: acc.losingDays + (day.pnl < 0 ? 1 : 0),
      avgPsychScore: day.psychologyScore !== null
        ? acc.avgPsychScore + day.psychologyScore
        : acc.avgPsychScore,
      psychScoreCount: day.psychologyScore !== null
        ? acc.psychScoreCount + 1
        : acc.psychScoreCount,
      excellentDays: day.psychologyScore !== null && day.psychologyScore >= 80
        ? acc.excellentDays + 1
        : acc.excellentDays,
      goodDays: day.psychologyScore !== null && day.psychologyScore >= 60 && day.psychologyScore < 80
        ? acc.goodDays + 1
        : acc.goodDays,
      challengedDays: day.psychologyScore !== null && day.psychologyScore < 60
        ? acc.challengedDays + 1
        : acc.challengedDays
    }),
    { totalPnl: 0, totalTrades: 0, winningDays: 0, losingDays: 0, avgPsychScore: 0, psychScoreCount: 0, excellentDays: 0, goodDays: 0, challengedDays: 0 }
  );

  const avgPsychScore = monthStats.psychScoreCount > 0
    ? Math.round(monthStats.avgPsychScore / monthStats.psychScoreCount)
    : 0;

  return (
    <div className="h-[calc(100vh-4rem)] bg-black text-white overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 text-white">Trading Calendar</h1>
            <p className="text-sm text-gray-400">Track your daily performance and psychology</p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-4">
            <div className="flex-1 bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-3 md:p-4 lg:p-6 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h2 className="text-lg md:text-xl font-bold min-w-[160px] text-center text-white">{monthName}</h2>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('pnl')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'pnl'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <DollarSign size={14} />
                        P&L
                      </div>
                    </button>
                    <button
                      onClick={() => setViewMode('psychology')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'psychology'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Brain size={14} />
                        Psych
                      </div>
                    </button>
                  </div>

                  {viewMode === 'pnl' && (
                    <button
                      onClick={() => setPrivacyMode(!privacyMode)}
                      className={`p-2 rounded-lg transition-colors ${
                        privacyMode
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                      title={privacyMode ? 'Show values' : 'Hide values'}
                    >
                      {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="grid grid-cols-8 gap-1 lg:gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map(day => (
                    <div key={day} className="text-center text-[10px] lg:text-xs font-semibold text-gray-500 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                  </div>
                ) : (
                  <>
                    <div
                      className="grid grid-cols-8 auto-rows-fr gap-1 lg:gap-2"
                      style={{
                        flex: '1 1 0',
                        minHeight: 0
                      }}
                    >
                      {renderCalendar()}
                    </div>

                    {viewMode === 'psychology' && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="text-xs text-gray-400 mb-2 font-semibold">Mental State Spectrum</div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-slate-600/20 to-gray-600/15 border border-slate-500/30" />
                            <span className="text-[10px] text-slate-300">Low</span>
                          </div>
                          <div className="w-1.5 h-[2px] bg-gradient-to-r from-slate-500/30 to-slate-500/30" />
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-slate-500/20 to-gray-600/12 border border-slate-500/30" />
                            <span className="text-[10px] text-slate-300">Neutral</span>
                          </div>
                          <div className="w-1.5 h-[2px] bg-gradient-to-r from-slate-500/30 to-blue-500/30" />
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-400/40 shadow-sm shadow-blue-500/10" />
                            <span className="text-[10px] text-blue-400">Strong</span>
                          </div>
                          <div className="w-1.5 h-[2px] bg-gradient-to-r from-blue-500/30 to-blue-600/30" />
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-blue-500/40 to-blue-600/30 border border-blue-400/60 shadow-md shadow-blue-500/20" />
                            <span className="text-[10px] text-blue-400">Peak</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="xl:w-80 xl:min-w-[320px] flex flex-col gap-3">
              {viewMode === 'pnl' ? (
                <>
                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="text-blue-400" size={16} />
                      <h3 className="text-xs font-semibold text-gray-400">Monthly P&L</h3>
                    </div>
                    {!privacyMode ? (
                      <p className={`text-xl md:text-2xl font-bold ${
                        monthStats.totalPnl > 0 ? 'text-blue-400' :
                        monthStats.totalPnl < 0 ? 'text-slate-300' : 'text-slate-300'
                      }`}>
                        {formatCurrency(monthStats.totalPnl)}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2">
                        {monthStats.totalPnl > 0 ? (
                          <TrendingUp size={20} className="text-blue-400" />
                        ) : monthStats.totalPnl < 0 ? (
                          <TrendingDown size={20} className="text-slate-300" />
                        ) : (
                          <div className="w-6 h-1 bg-slate-300" />
                        )}
                        <span className="text-gray-400 text-xs">Privacy mode</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2">Total Trades</h3>
                    <p className="text-xl md:text-2xl font-bold text-white">{monthStats.totalTrades}</p>
                  </div>

                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2">Win/Loss Days</h3>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xl md:text-2xl font-bold text-blue-400">{monthStats.winningDays}</p>
                        <p className="text-xs text-gray-400">Wins</p>
                      </div>
                      <div className="text-gray-600">/</div>
                      <div className="text-center">
                        <p className="text-xl md:text-2xl font-bold text-slate-300">{monthStats.losingDays}</p>
                        <p className="text-xs text-gray-400">Loss</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`bg-[#111]/80 backdrop-blur-sm border rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 ${
                    avgPsychScore >= 90 ? 'border-blue-500/40 shadow-lg shadow-blue-500/15' :
                    avgPsychScore >= 80 ? 'border-blue-500/35 shadow-lg shadow-blue-500/12' :
                    avgPsychScore >= 70 ? 'border-blue-500/30 shadow-lg shadow-blue-500/10' :
                    avgPsychScore >= 60 ? 'border-blue-500/25 shadow-lg shadow-blue-500/10' :
                    avgPsychScore >= 50 ? 'border-slate-500/25 shadow-lg shadow-slate-500/10' :
                    'border-white/[0.05]'
                  }`}>
                    <div className={`absolute inset-0 transition-opacity duration-300 ${
                      avgPsychScore >= 90 ? 'bg-gradient-to-br from-blue-500/15 via-blue-400/8 to-transparent' :
                      avgPsychScore >= 80 ? 'bg-gradient-to-br from-blue-500/14 via-blue-400/7 to-transparent' :
                      avgPsychScore >= 70 ? 'bg-gradient-to-br from-blue-500/12 via-blue-400/6 to-transparent' :
                      avgPsychScore >= 60 ? 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent' :
                      avgPsychScore >= 50 ? 'bg-gradient-to-br from-slate-500/10 via-gray-600/5 to-transparent' :
                      'bg-gradient-to-br from-slate-500/10 to-transparent'
                    }`} />

                    <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${
                      avgPsychScore >= 80 ? 'bg-blue-500/20 opacity-100' :
                      avgPsychScore >= 70 ? 'bg-blue-500/18 opacity-100' :
                      avgPsychScore >= 50 ? 'bg-blue-500/15 opacity-100' : 'opacity-0'
                    }`} />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl backdrop-blur-sm transition-all duration-300 ${
                            avgPsychScore >= 90 ? 'bg-blue-500/20 shadow-lg shadow-blue-500/30' :
                            avgPsychScore >= 80 ? 'bg-blue-500/18 shadow-lg shadow-blue-500/28' :
                            avgPsychScore >= 70 ? 'bg-blue-500/16 shadow-lg shadow-blue-500/25' :
                            avgPsychScore >= 60 ? 'bg-blue-500/15 shadow-md shadow-blue-500/20' :
                            avgPsychScore >= 50 ? 'bg-slate-500/15' : 'bg-gray-500/15'
                          }`}>
                            <Brain className={`transition-all duration-300 ${
                              avgPsychScore >= 90 ? 'text-blue-400' :
                              avgPsychScore >= 80 ? 'text-blue-400' :
                              avgPsychScore >= 70 ? 'text-blue-400' :
                              avgPsychScore >= 50 ? 'text-blue-400' : 'text-gray-400'
                            }`} size={20} />
                          </div>
                          <h3 className="text-xs font-semibold text-gray-300 tracking-wide">Average Mental State</h3>
                        </div>
                      </div>

                      <div className="flex items-end gap-3 mb-4">
                        <p className={`text-5xl font-bold tracking-tight transition-all duration-300 ${
                          avgPsychScore >= 90 ? 'text-blue-400' :
                          avgPsychScore >= 80 ? 'text-blue-400' :
                          avgPsychScore >= 70 ? 'text-blue-400' :
                          avgPsychScore >= 60 ? 'text-blue-400' :
                          avgPsychScore >= 50 ? 'text-slate-300' : 'text-gray-400'
                        }`}>
                          {avgPsychScore > 0 ? avgPsychScore : '--'}
                        </p>
                        <span className="text-sm text-gray-500 mb-2">/ 100</span>
                      </div>

                      <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full transition-all duration-700 rounded-full ${
                            avgPsychScore >= 90 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                            avgPsychScore >= 80 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                            avgPsychScore >= 70 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                            avgPsychScore >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                            avgPsychScore >= 50 ? 'bg-gradient-to-r from-slate-500 to-gray-500' :
                            'bg-gradient-to-r from-gray-500 to-slate-400'
                          }`}
                          style={{ width: `${avgPsychScore}%` }}
                        />
                      </div>

                      {avgPsychScore > 0 && (
                        <div className="flex items-center justify-between">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm ${getPsychologyMood(avgPsychScore).bg} border ${
                            avgPsychScore >= 80 ? 'border-white/10' : 'border-white/5'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              avgPsychScore >= 80 ? 'bg-blue-400 animate-pulse' :
                              avgPsychScore >= 70 ? 'bg-blue-400' :
                              avgPsychScore >= 60 ? 'bg-blue-400' : 'bg-slate-400'
                            }`} />
                            <span className={`text-xs font-semibold ${getPsychologyMood(avgPsychScore).color}`}>
                              {getPsychologyMood(avgPsychScore).text}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-3">Mental Performance</h3>
                    <div className="space-y-3">
                      <div className="group hover:scale-105 transition-transform">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-lg shadow-blue-500/50" />
                            <span className="text-xs text-gray-300">Peak Days</span>
                          </div>
                          <span className="text-sm font-bold text-blue-400">{monthStats.excellentDays}</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${monthStats.psychScoreCount > 0 ? (monthStats.excellentDays / monthStats.psychScoreCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="group hover:scale-105 transition-transform">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-md shadow-blue-500/50" />
                            <span className="text-xs text-gray-300">Good Days</span>
                          </div>
                          <span className="text-sm font-bold text-blue-400">{monthStats.goodDays}</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${monthStats.psychScoreCount > 0 ? (monthStats.goodDays / monthStats.psychScoreCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="group hover:scale-105 transition-transform">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-slate-500 to-gray-500 shadow-md shadow-slate-500/50" />
                            <span className="text-xs text-gray-300">Challenging Days</span>
                          </div>
                          <span className="text-sm font-bold text-slate-300">{monthStats.challengedDays}</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-slate-500 to-gray-500 rounded-full transition-all duration-500"
                            style={{ width: `${monthStats.psychScoreCount > 0 ? (monthStats.challengedDays / monthStats.psychScoreCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-3">Tracking Consistency</h3>
                    <div className="flex items-end gap-2 mb-2">
                      <p className="text-2xl md:text-3xl font-bold text-white">{monthStats.psychScoreCount}</p>
                      <span className="text-sm text-gray-500 mb-1">entries</span>
                    </div>
                    <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 rounded-full transition-all duration-500 shadow-lg"
                        style={{ width: `${Math.min((monthStats.psychScoreCount / daysInMonth) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                      <span>{Math.round((monthStats.psychScoreCount / daysInMonth) * 100)}% of month</span>
                      <span>{daysInMonth - monthStats.psychScoreCount} days left</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-bold mb-4 text-white">
              {new Date(selectedDay.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h3>

            <div className="space-y-3">
              {selectedDay.tradeCount > 0 && (
                <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3">Trading Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Trades:</span>
                      <span className="text-sm font-semibold text-white">{selectedDay.tradeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">P&L:</span>
                      <span className={`text-sm font-semibold ${
                        selectedDay.pnl > 0 ? 'text-blue-400' :
                        selectedDay.pnl < 0 ? 'text-slate-300' : 'text-slate-300'
                      }`}>
                        {!privacyMode ? formatCurrency(selectedDay.pnl) : '***'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedDay.hasJournal && (
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 relative overflow-hidden">
                  {selectedDay.psychologyScore !== null && (
                    <div className={`absolute inset-0 ${getPsychologyMood(selectedDay.psychologyScore).bg} opacity-30`} />
                  )}
                  <div className="relative">
                    <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <Brain size={14} />
                      Mental State Assessment
                    </h4>
                    {selectedDay.psychologyScore !== null ? (
                      <>
                        <div className="flex items-center justify-center mb-4">
                          <div className="relative">
                            <div className={`text-5xl font-bold ${getPsychologyTextColor(selectedDay.psychologyScore)}`}>
                              {selectedDay.psychologyScore}
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-1">NOVA Score</div>
                          </div>
                        </div>
                        <div className={`flex flex-col items-center gap-3 p-5 rounded-xl ${getPsychologyGradient(selectedDay.psychologyScore)} backdrop-blur-sm`}>
                          <span className={`text-lg font-bold ${getPsychologyMood(selectedDay.psychologyScore).color} uppercase tracking-widest`}>
                            {getPsychologyMood(selectedDay.psychologyScore).text}
                          </span>
                          <div className="text-xs text-gray-400 font-medium">Mental State Classification</div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-2">Journal entry exists (no score available)</p>
                    )}
                  </div>
                </div>
              )}

              {!selectedDay.tradeCount && !selectedDay.hasJournal && (
                <p className="text-center text-sm text-gray-400 py-4">No data for this day</p>
              )}
            </div>

            <button
              onClick={() => setSelectedDay(null)}
              className="w-full mt-6 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <TradingReportModal
        report={selectedReport}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
