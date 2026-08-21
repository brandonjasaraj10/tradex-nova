import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart, ChevronLeft, ChevronRight, Plus, CreditCard as Edit2, Brain, TrendingDown, BookOpen, Settings, Trash2, X, Eye, EyeOff, BarChart3 } from 'lucide-react';
import Card from '../components/shared/Card';
import Button from '../components/shared/Button';
import DateRangePicker from '../components/shared/DateRangePicker';
import AccountSelector from '../components/shared/AccountSelector';
import BalanceCard from '../components/dashboard/BalanceCard';
import { useAccount } from '../lib/accountContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import NOVAScore from '../components/shared/NOVAScore';
import { calculateNOVAScore, type NOVAScoreBreakdown } from '../services/novaScore';
import { useDataSync } from '../lib/dataSync';
import PsychologyScore from '../components/shared/PsychologyScore';
import {
  getUserConfluences,
  getTradingPlanSettings,
  createConfluence,
  updateConfluence,
  deleteConfluence,
  updateTradingPlanSettings,
  initializeDefaultConfluences,
  type Confluence,
  type TradingPlanSettings
} from '../services/confluences';
import { getRecentTrades, getTradeStats, getDailyPnL } from '../services/trades';
import type { TradeStats } from '../types/trade';
import { getNotes, createNote, updateNote, deleteNote, toggleNoteReadStatus, type Note } from '../services/notes';
import type { Trade } from '../types/trade';
import { getTradingRules, createTradingRule, updateTradingRule, deleteTradingRule, type TradingRule } from '../services/tradingRules';
import { generateReport, getWeekBounds, getMonthBounds, getQuarterBounds, getYearBounds, type TradingReport } from '../services/reports';
import TradingReportModal from '../components/reports/TradingReportModal';
import { toLocalDateStr } from '../utils/dateHelpers';


const buildCalendarData = (
  year: number,
  month: number,
  dailyPnL: Map<number, { pnl: number; trades: number; hasJournal: boolean }>
) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const firstDayOfMonth = firstDay.getDay();
  const currentDate = new Date();
  const calendarData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayData = dailyPnL.get(day);

    if (date > currentDate) {
      calendarData.push({ date, day, pnl: 0, trades: 0, psychologyScore: null, hasJournal: false, future: true, isEmpty: true });
    } else if (dayData && (dayData.trades > 0 || dayData.hasJournal)) {
      calendarData.push({ date, day, pnl: dayData.pnl, trades: dayData.trades, psychologyScore: null, hasJournal: dayData.hasJournal, isEmpty: false });
    } else {
      calendarData.push({ date, day, pnl: 0, trades: 0, psychologyScore: null, hasJournal: false, isEmpty: true });
    }
  }

  return { data: calendarData, firstDayOfMonth };
};

function WinningDaysCard({ winningDays }: { winningDays: number }) {
  const barHeights = useMemo(() => {
    return Array.from({ length: 20 }).map(() => 40 + Math.random() * 60);
  }, []);

  return (
    <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs sm:text-sm text-gray-400">Winning Days %</h3>
      </div>
      <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{winningDays}%</span>
      <div className="mt-3 flex items-end gap-px h-6">
        {barHeights.map((height, i) => {
          const isWin = i < Math.round(winningDays / 5);
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm ${isWin ? 'bg-blue-500' : 'bg-gray-700'}`}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { accounts, selectedAccount, setSelectedAccount, refreshAccounts } = useAccount();
  const { refreshTrigger } = useDataSync();
  const [activeTab, setActiveTab] = useState('trades');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState(() =>
    buildCalendarData(selectedDate.getFullYear(), selectedDate.getMonth(), new Map())
  );
  const [performanceStats, setPerformanceStats] = useState<TradeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [confluences, setConfluences] = useState<Confluence[]>([]);
  const [tradingPlanSettings, setTradingPlanSettings] = useState<TradingPlanSettings | null>(null);
  const [showAddConfluence, setShowAddConfluence] = useState(false);
  const [editingConfluence, setEditingConfluence] = useState<Confluence | null>(null);
  const [newConfluence, setNewConfluence] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [novaScore, setNovaScore] = useState<NOVAScoreBreakdown | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [tradingRules, setTradingRules] = useState<TradingRule[]>([]);
  const [planSectionTab, setPlanSectionTab] = useState<'confluences' | 'rules'>('confluences');
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', description: '', category: 'other' as const });
  const [calendarViewMode, setCalendarViewMode] = useState<'pnl' | 'psychology'>('pnl');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [averageRuleAdherence, setAverageRuleAdherence] = useState<number | null>(null);
  const [selectedReport, setSelectedReport] = useState<TradingReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    return { startDate, endDate };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  const handleGenerateReport = async (reportType: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setLoadingReport(true);
    try {
      const now = new Date();
      let bounds;
      switch (reportType) {
        case 'weekly': bounds = getWeekBounds(now); break;
        case 'monthly': bounds = getMonthBounds(now); break;
        case 'quarterly': bounds = getQuarterBounds(now); break;
        case 'yearly': bounds = getYearBounds(now); break;
      }

      const report = await generateReport(user.id, reportType, bounds.start, bounds.end);
      setSelectedReport(report);
      setShowReportModal(true);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadConfluences();
    calculateAndSetNovaScore();
    loadRecentTrades();
    loadNotes();
    loadTradingRules();
    loadPerformanceStats();
  }, [refreshTrigger, selectedAccount, dateRange]);

  useEffect(() => {
    loadCalendarData();
  }, [selectedDate, selectedAccount, refreshTrigger]);

  const loadPerformanceStats = async () => {
    try {
      setStatsLoading(true);
      const stats = await getTradeStats(
        [dateRange.startDate, dateRange.endDate],
        selectedAccount?.id
      );
      setPerformanceStats(stats);
    } catch (error) {
      console.error('Error loading performance stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCalendarData = async () => {
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const dailyData = await getDailyPnL(year, month, selectedAccount?.id);
      setCalendarData(buildCalendarData(year, month, dailyData));
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setCalendarData(buildCalendarData(selectedDate.getFullYear(), selectedDate.getMonth(), new Map()));
    }
  };

  const loadRecentTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let tradesQuery = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', dateRange.startDate.toISOString())
        .lte('entry_date', dateRange.endDate.toISOString())
        .order('entry_date', { ascending: false })
        .limit(20);

      if (selectedAccount) {
        tradesQuery = tradesQuery.eq('broker_id', selectedAccount.id);
      }

      const { data: tradesData, error: tradesError } = await tradesQuery;
      if (tradesError) throw tradesError;

      let journalQuery = supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('manual_pnl', 'is', null)
        .gte('entry_date', toLocalDateStr(dateRange.startDate))
        .lte('entry_date', toLocalDateStr(dateRange.endDate))
        .order('entry_date', { ascending: false })
        .limit(20);

      // journal_entries does carry account_id, so journal-logged P&L
      // scopes to the selected account exactly like trades do.
      if (selectedAccount) {
        journalQuery = journalQuery.eq('account_id', selectedAccount.id);
      }

      const { data: journalData, error: journalError } = await journalQuery;
      if (journalError) throw journalError;

      const journalTrades = (journalData || [])
        .map((entry: any) => ({
          id: entry.id,
          user_id: entry.user_id,
          symbol: entry.symbol || 'N/A',
          entry_price: 0,
          exit_price: 0,
          quantity: 0,
          direction: (entry.direction || 'LONG') as 'LONG' | 'SHORT',
          entry_date: entry.entry_date,
          exit_date: entry.entry_date,
          pnl: entry.manual_pnl || 0,
          fees: 0,
          notes: entry.content?.replace(/<[^>]*>/g, '').substring(0, 100) || '',
          tags: entry.tags || [],
          created_at: entry.created_at,
          updated_at: entry.updated_at,
        }));

      const allTrades = [...(tradesData || []), ...journalTrades]
        .sort((a, b) => new Date(b.entry_date || b.created_at).getTime() - new Date(a.entry_date || a.created_at).getTime())
        .slice(0, 15);

      setRecentTrades(allTrades);
    } catch (error) {
      console.error('Error loading recent trades:', error);
      setRecentTrades([]);
    }
  };

  const loadNotes = async () => {
    const fetchedNotes = await getNotes(10);
    setNotes(fetchedNotes);
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    const newNote = await createNote(noteContent);
    if (newNote) {
      setNotes([newNote, ...notes]);
      setNoteContent('');
      setShowAddNote(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !noteContent.trim()) return;

    const updated = await updateNote(editingNote.id, noteContent);
    if (updated) {
      setNotes(notes.map(n => n.id === updated.id ? updated : n));
      setEditingNote(null);
      setNoteContent('');
    }
  };

  const handleDeleteNote = async (id: string) => {
    const success = await deleteNote(id);
    if (success) {
      setNotes(notes.filter(n => n.id !== id));
    }
  };

  const startEditingNote = (note: Note) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setShowAddNote(false);
  };

  const cancelEditingNote = () => {
    setEditingNote(null);
    setNoteContent('');
  };

  const formatTradeTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatTradeDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const loadTradingRules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rules = await getTradingRules(user.id);
      setTradingRules(rules);

      // Calculate average adherence for enabled rules
      const enabledRules = rules.filter(r => r.enabled);
      if (enabledRules.length > 0) {
        const adherenceRates = await Promise.all(
          enabledRules.map(async (rule) => {
            const { data, error } = await supabase
              .from('journal_entry_rules')
              .select('followed')
              .eq('rule_id', rule.id);

            if (error || !data || data.length === 0) return 0;

            const followedCount = data.filter(entry => entry.followed === true).length;
            return Math.round((followedCount / data.length) * 100);
          })
        );

        const avgAdherence = Math.round(
          adherenceRates.reduce((sum, rate) => sum + rate, 0) / adherenceRates.length
        );
        setAverageRuleAdherence(avgAdherence);
      } else {
        setAverageRuleAdherence(0);
      }
    } catch (error) {
      console.error('Error loading trading rules:', error);
    }
  };

  const handleToggleNoteRead = async (note: Note) => {
    const updated = await toggleNoteReadStatus(note.id, note.is_read);
    if (updated) {
      setNotes(notes.map(n => n.id === updated.id ? updated : n));
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maxOrder = Math.max(...tradingRules.map(r => r.order_index), -1);
      const rule = await createTradingRule({
        user_id: user.id,
        name: newRule.name,
        description: newRule.description,
        category: newRule.category,
        enabled: true,
        order_index: maxOrder + 1
      });

      setTradingRules([...tradingRules, rule]);
      setNewRule({ name: '', description: '', category: 'other' });
      setShowAddRule(false);
    } catch (error) {
      console.error('Error adding rule:', error);
    }
  };

  const handleToggleRule = async (rule: TradingRule) => {
    setTradingRules(tradingRules.map(r =>
      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
    ));

    try {
      await updateTradingRule(rule.id, { enabled: !rule.enabled });
    } catch (error) {
      console.error('Error toggling rule:', error);
      setTradingRules(tradingRules.map(r =>
        r.id === rule.id ? { ...r, enabled: rule.enabled } : r
      ));
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteTradingRule(id);
      setTradingRules(tradingRules.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const calculateAndSetNovaScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let tradesQuery = supabase
        .from('trades')
        .select('pnl, entry_date, exit_date, created_at')
        .eq('user_id', user.id)
        .gte('entry_date', dateRange.startDate.toISOString())
        .lte('entry_date', dateRange.endDate.toISOString())
        .order('entry_date', { ascending: false })
        .limit(100);

      if (selectedAccount) {
        tradesQuery = tradesQuery.eq('broker_id', selectedAccount.id);
      }

      const { data: tradesData } = await tradesQuery;

      let journalScoreQuery = supabase
        .from('journal_entries')
        .select('manual_pnl, entry_date, created_at')
        .eq('user_id', user.id)
        .not('manual_pnl', 'is', null)
        .gte('entry_date', toLocalDateStr(dateRange.startDate))
        .lte('entry_date', toLocalDateStr(dateRange.endDate))
        .order('entry_date', { ascending: false })
        .limit(100);

      // journal_entries does carry account_id, so journal-logged P&L
      // scopes to the selected account exactly like trades do.
      if (selectedAccount) {
        journalScoreQuery = journalScoreQuery.eq('account_id', selectedAccount.id);
      }

      const { data: journalData, error: journalScoreError } = await journalScoreQuery;
      if (journalScoreError) throw journalScoreError;

      const tradeItems = (tradesData || []).map((t: any) => ({
        profit_loss: t.pnl || 0,
        entry_time: t.entry_date || t.created_at,
        exit_time: t.exit_date || t.entry_date || t.created_at,
      }));

      const journalItems = (journalData || [])
        .map((e: any) => ({
          profit_loss: e.manual_pnl || 0,
          entry_time: e.entry_date || e.created_at,
          exit_time: e.entry_date || e.created_at,
        }));

      const allTrades = [...tradeItems, ...journalItems];

      if (allTrades.length === 0) {
        setNovaScore(null);
        return;
      }

      const score = await calculateNOVAScore(allTrades);
      setNovaScore(score);
    } catch (error) {
      console.error('Error calculating NOVA score:', error);
      setNovaScore(null);
    }
  };

  const loadConfluences = async () => {
    try {
      setLoading(true);
      const [confluencesData, settingsData] = await Promise.all([
        getUserConfluences(),
        getTradingPlanSettings()
      ]);

      if (confluencesData.length === 0) {
        await initializeDefaultConfluences();
        const newData = await getUserConfluences(selectedAccount?.id);
        setConfluences(newData);
      } else {
        setConfluences(confluencesData);
      }

      setTradingPlanSettings(settingsData);
    } catch (error) {
      console.error('Error loading confluences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfluence = async () => {
    if (!newConfluence.name.trim()) return;

    try {
      const maxOrder = Math.max(...confluences.map(c => c.order_index), -1);
      const newConf = await createConfluence({
        ...newConfluence,
        order_index: maxOrder + 1
      });
      setConfluences([...confluences, newConf]);
      setNewConfluence({ name: '', description: '' });
      setShowAddConfluence(false);
    } catch (error) {
      console.error('Error adding confluence:', error);
    }
  };

  const handleUpdateConfluence = async (id: string, updates: Partial<Confluence>) => {
    try {
      const updated = await updateConfluence(id, updates);
      setConfluences(confluences.map(c => c.id === id ? updated : c));
      setEditingConfluence(null);
    } catch (error) {
      console.error('Error updating confluence:', error);
    }
  };

  const handleDeleteConfluence = async (id: string) => {
    try {
      await deleteConfluence(id);
      setConfluences(confluences.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting confluence:', error);
    }
  };

  const handleToggleConfluence = async (confluence: Confluence) => {
    setConfluences(confluences.map(c =>
      c.id === confluence.id ? { ...c, enabled: !c.enabled } : c
    ));

    try {
      await updateConfluence(confluence.id, { enabled: !confluence.enabled });
    } catch (error) {
      console.error('Error toggling confluence:', error);
      setConfluences(confluences.map(c =>
        c.id === confluence.id ? { ...c, enabled: confluence.enabled } : c
      ));
    }
  };

  // Averages only confluences that have actually been tracked. Counting
  // untracked ones as 0 pulled the figure down and made a real 100% rate
  // read as a fraction of it.
  const trackedConfluences = confluences.filter(c => c.usage_rate !== null);
  const averageConfluenceUsage = trackedConfluences.length > 0
    ? Math.round(trackedConfluences.reduce((acc, conf) => acc + (conf.usage_rate as number), 0) / trackedConfluences.length)
    : null;

  // Handle month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  // Handle "Today" button
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric',
      month: 'long'
    }).format(date);
  };

  // Handle calendar day click
  const handleDayClick = (day: { date: Date; pnl: number; trades: number; psychologyScore: number | null; hasJournal: boolean; future?: boolean; isEmpty?: boolean }) => {
    if (day.future) return;

    const y = day.date.getFullYear();
    const m = String(day.date.getMonth() + 1).padStart(2, '0');
    const d = String(day.date.getDate()).padStart(2, '0');
    navigate(`/journal?date=${y}-${m}-${d}`);
  };

  const getPsychologyColor = (score: number) => {
    if (score >= 90) return 'bg-gradient-to-br from-blue-500/40 via-blue-400/30 to-blue-600/25 border-blue-400/60 shadow-lg shadow-blue-500/20';
    if (score >= 80) return 'bg-gradient-to-br from-blue-400/35 via-blue-500/25 to-blue-600/20 border-blue-400/50 shadow-md shadow-blue-500/15';
    if (score >= 70) return 'bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/15 border-blue-400/40 shadow-md shadow-blue-500/10';
    if (score >= 60) return 'bg-gradient-to-br from-blue-400/25 via-blue-500/15 to-blue-600/10 border-blue-400/35 shadow-sm shadow-blue-500/5';
    if (score >= 50) return 'bg-gradient-to-br from-slate-500/20 via-gray-600/12 to-zinc-600/10 border-slate-500/30';
    if (score >= 40) return 'bg-gradient-to-br from-slate-400/20 via-gray-500/15 to-zinc-500/10 border-slate-400/30';
    if (score >= 30) return 'bg-gradient-to-br from-slate-500/18 via-gray-600/12 to-zinc-600/8 border-slate-500/25';
    return 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/30';
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto pb-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
      >
        {/* Header */}
        <motion.div variants={fadeInUp} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pt-6" data-tour="dashboard-header">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <div className="relative group">
              <button
                disabled={loadingReport}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 className="w-4 h-4" />
                {loadingReport ? 'Generating...' : 'View Reports'}
              </button>
              <div className="absolute right-0 top-full mt-2 w-40 bg-[#0A0A0A] border border-blue-400/30 rounded-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-30" style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
              }}>
                <button
                  onClick={() => handleGenerateReport('weekly')}
                  disabled={loadingReport}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  This Week
                </button>
                <button
                  onClick={() => handleGenerateReport('monthly')}
                  disabled={loadingReport}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  This Month
                </button>
                <button
                  onClick={() => handleGenerateReport('quarterly')}
                  disabled={loadingReport}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  This Quarter
                </button>
                <button
                  onClick={() => handleGenerateReport('yearly')}
                  disabled={loadingReport}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  This Year
                </button>
              </div>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <div data-tour="account-selector">
              <AccountSelector
                accounts={accounts}
                selectedAccount={selectedAccount}
                onAccountChange={setSelectedAccount}
                onAccountsUpdate={refreshAccounts}
              />
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="mt-4">
          <BalanceCard />
        </motion.div>

        {/* Quick Navigation - Full Width */}
        <motion.div variants={fadeInUp} className="mt-4" data-tour="quick-access">
          <Card variant="gradient" className="bg-[#111]/80 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => navigate('/journal')}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <BookOpen size={16} className="text-gray-400 group-hover:text-white" />
                <span className="text-sm">Journal</span>
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <BarChart size={16} className="text-gray-400 group-hover:text-white" />
                <span className="text-sm">Analytics</span>
              </button>
              <button
                onClick={() => navigate('/nova')}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <Brain size={16} className="text-gray-400 group-hover:text-white" />
                <span className="text-sm">NOVA AI</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <Settings size={16} className="text-gray-400 group-hover:text-white" />
                <span className="text-sm">Settings</span>
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Key Metrics - Full Width */}
        <motion.div variants={fadeInUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4" data-tour="metrics">
          {/* NOVAScore Card */}
          <Card variant="gradient" className="bg-gradient-to-br from-gold-400/10 to-gold-400/5 p-3 sm:p-4 border border-gold-400/20">
            <div className="flex flex-col items-center justify-center h-full">
              <NOVAScore breakdown={novaScore} size="sm" showBreakdown={false} />
            </div>
          </Card>

          <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm text-gray-400">Total P&L</h3>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-3 flex-wrap">
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">
                {statsLoading ? '...' : formatCurrency(performanceStats?.total_pnl || 0)}
              </span>
              {performanceStats && performanceStats.total_pnl > 0 && (
                <span className="text-[10px] sm:text-xs text-blue-400 flex items-center flex-shrink-0">
                  <ArrowUpRight size={10} />
                </span>
              )}
              {performanceStats && performanceStats.total_pnl < 0 && (
                <span className="text-[10px] sm:text-xs text-gray-400 flex items-center flex-shrink-0">
                  <ArrowDownRight size={10} />
                </span>
              )}
            </div>
            <svg viewBox="0 0 100 24" className="w-full h-6" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,20 Q10,18 20,16 T40,12 T60,8 T80,10 T100,4"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              <path
                d="M0,20 Q10,18 20,16 T40,12 T60,8 T80,10 T100,4 V24 H0 Z"
                fill="url(#pnlGradient)"
              />
            </svg>
          </Card>

          <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm text-gray-400">Profit Factor</h3>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">
                {statsLoading ? '...' : performanceStats ? (performanceStats.profit_factor === Infinity ? '---' : performanceStats.profit_factor.toFixed(2)) : '0'}
              </span>
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#1f1f1f" strokeWidth="4" />
                  <circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeDasharray={`${(Math.min(performanceStats?.profit_factor === Infinity ? 4 : (performanceStats?.profit_factor || 0), 4) / 4) * 88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </Card>

          <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm text-gray-400">Win Rate %</h3>
            </div>
            <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">
              {statsLoading ? '...' : `${(performanceStats?.win_rate || 0).toFixed(1)}%`}
            </span>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-blue-400 w-8">{(performanceStats?.win_rate || 0).toFixed(0)}%</span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${performanceStats?.win_rate || 0}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-8">{(100 - (performanceStats?.win_rate || 0)).toFixed(0)}%</span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full bg-gray-600 rounded-full" style={{ width: `${100 - (performanceStats?.win_rate || 0)}%` }} />
                </div>
              </div>
            </div>
          </Card>

          <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm text-gray-400">Total Trades</h3>
            </div>
            <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">
              {statsLoading ? '...' : performanceStats?.total_trades || 0}
            </span>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-blue-400">{performanceStats?.winning_trades || 0} W</span>
              <span className="text-gray-600">/</span>
              <span className="text-gray-400">{performanceStats?.losing_trades || 0} L</span>
            </div>
          </Card>

          <Card variant="gradient" className="bg-[#111]/80 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm text-gray-400">Avg Win/Loss $</h3>
            </div>
            <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">
              {statsLoading ? '...' : formatCurrency(performanceStats?.average_win || 0)}
            </span>
            <div className="mt-3">
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                  style={{ width: `${Math.min(((performanceStats?.average_win || 0) / Math.max(Math.abs(performanceStats?.average_loss || 1), 1)) * 50, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
                <span>Avg Loss: {formatCurrency(performanceStats?.average_loss || 0)}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Second Section - Calendar and NOVA AI */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-6">
          {/* Left Column - Calendar */}
          <div className="xl:col-span-6 space-y-4">

            {/* Calendar - Full Width */}
            <motion.div variants={fadeInUp} className="h-full" data-tour="calendar">
              <Card variant="default" className="bg-[#111]/80 p-3 sm:p-4 lg:p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 sm:mb-5">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-medium truncate">{formatDate(selectedDate)}</h2>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1.5 hover:bg-white/5 rounded transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1.5 hover:bg-white/5 rounded transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-0.5">
                      <button
                        onClick={() => setCalendarViewMode('pnl')}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          calendarViewMode === 'pnl'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <DollarSign size={12} />
                          P&L
                        </div>
                      </button>
                      <button
                        onClick={() => setCalendarViewMode('psychology')}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          calendarViewMode === 'psychology'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <Brain size={12} />
                          Psych
                        </div>
                      </button>
                    </div>
                    {calendarViewMode === 'pnl' && (
                      <button
                        onClick={() => setPrivacyMode(!privacyMode)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          privacyMode
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                        title={privacyMode ? 'Show values' : 'Hide values'}
                      >
                        {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={goToToday}
                    >
                      Today
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-0.5 sm:gap-1 lg:gap-1.5 xl:gap-2 flex-1 content-start">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                    <div key={i} className="text-center text-[10px] sm:text-xs text-gray-400 py-1 sm:py-2 font-medium">
                      {day}
                    </div>
                  ))}

                  {Array.from({ length: calendarData.firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {calendarData.data.map((day, i) => {
                    const isProfitable = day.pnl > 0;
                    const hasPsychData = day.hasJournal && day.psychologyScore !== null;

                    return (
                      <div
                        key={i}
                        onClick={() => handleDayClick(day)}
                        className={`
                          aspect-square rounded-sm sm:rounded-md lg:rounded-lg p-0.5 sm:p-1 lg:p-1.5 xl:p-2 border
                          ${day.future ? 'opacity-50 cursor-default bg-white/5 border-white/10' : 'cursor-pointer hover:ring-1 sm:hover:ring-2 hover:ring-white/20'}
                          ${!day.future && (calendarViewMode === 'pnl' ? day.isEmpty : day.isEmpty && !hasPsychData) ? 'bg-white/[0.03] border-white/10' : ''}
                          ${calendarViewMode === 'psychology' && !day.isEmpty && !hasPsychData && !day.future ? 'bg-white/5 border-blue-400/70 shadow-lg shadow-blue-500/40' : ''}
                          ${calendarViewMode === 'pnl' && !day.isEmpty && !day.future
                            ? day.trades > 0
                              ? (isProfitable
                                  ? 'bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/15 border-blue-400/40 shadow-md shadow-blue-500/10'
                                  : 'bg-gradient-to-br from-slate-600/20 via-gray-600/15 to-zinc-600/10 border-slate-500/40 shadow-sm shadow-slate-500/5')
                              : 'bg-white/5 border-blue-400/70 shadow-lg shadow-blue-500/40'
                            : ''
                          }
                          ${calendarViewMode === 'psychology' && hasPsychData
                            ? getPsychologyColor(day.psychologyScore!)
                            : ''
                          }
                          transition-all overflow-hidden
                        `}
                      >
                        <div className="h-full flex flex-col justify-between min-w-0">
                          <span className="text-[8px] sm:text-[9px] lg:text-[10px] xl:text-xs font-medium">{day.day}</span>
                          {calendarViewMode === 'pnl' && !day.isEmpty && !day.future && (
                            <div className="text-[7px] sm:text-[8px] lg:text-[9px] xl:text-[10px] font-medium mt-0.5 sm:mt-1 min-w-0 leading-tight">
                              {day.trades === 0 ? (
                                <div className="text-center text-blue-400">Journal</div>
                              ) : !privacyMode ? (
                                <>
                                  <div className={`truncate break-all leading-tight ${isProfitable ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]' : 'text-slate-300'}`}>
                                    {formatCurrency(day.pnl)}
                                  </div>
                                  <div className="text-[6px] sm:text-[7px] lg:text-[8px] xl:text-[9px] text-gray-500 mt-0.5 truncate leading-tight">
                                    {day.trades}tr
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center">
                                  {isProfitable ? (
                                    <TrendingUp size={10} className="text-blue-400" />
                                  ) : (
                                    <TrendingDown size={10} className="text-slate-300" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {calendarViewMode === 'psychology' && hasPsychData && (
                            <div className="text-center">
                              <div className={`text-xs font-bold ${getPsychologyTextColor(day.psychologyScore!)}`}>
                                {day.psychologyScore}
                              </div>
                              <div className="text-[7px] text-gray-400 mt-0.5">NOVA</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Psychology Score */}
          <div className="xl:col-span-6 space-y-4">
            <motion.div variants={fadeInUp} className="h-full" data-tour="psychology-score">
              <PsychologyScore />
            </motion.div>
          </div>
        </div>

        {/* NOVAScore Detailed Breakdown */}
        <motion.div variants={fadeInUp} className="mt-6">
          <Card variant="gradient" className="bg-gradient-to-br from-gold-400/10 to-gold-400/5 p-5 border border-gold-400/20">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <h2 className="text-lg font-medium">Your NOVA Score</h2>
                  <p className="text-sm text-gray-400">Comprehensive performance analysis</p>
                </div>
              </div>
            </div>
            <div className="w-full">
              <NOVAScore breakdown={novaScore} size="md" showBreakdown={true} />
            </div>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div variants={fadeInUp} className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
          {/* Trades & Notes */}
          <Card variant="default" className="bg-[#111]/80 p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-6">
                <button 
                  className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                    activeTab === 'trades' 
                      ? 'text-white border-white' 
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                  onClick={() => setActiveTab('trades')}
                >
                  Trades
                </button>
                <button 
                  className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                    activeTab === 'notes' 
                      ? 'text-white border-white' 
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                  onClick={() => setActiveTab('notes')}
                >
                  Notes
                </button>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => {
                  setActiveTab('notes');
                  setShowAddNote(true);
                  setEditingNote(null);
                  setNoteContent('');
                }}
              >
                Add Note
              </Button>
            </div>

            {(showAddNote || editingNote) && (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">{editingNote ? 'Edit Note' : 'Add New Note'}</h3>
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      cancelEditingNote();
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Enter your note..."
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 min-h-[100px] resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={editingNote ? handleUpdateNote : handleAddNote}
                    disabled={!noteContent.trim()}
                  >
                    {editingNote ? 'Update' : 'Save'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowAddNote(false);
                      cancelEditingNote();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {activeTab === 'trades' && (
                recentTrades.length > 0 ? (
                  recentTrades.map((trade) => (
                    <div key={trade.id} className="flex gap-4 group p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-2 ${trade.pnl > 0 ? 'bg-blue-400' : trade.pnl < 0 ? 'bg-gray-400' : 'bg-gray-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{formatTradeDate(trade.entry_date || trade.created_at)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-sm font-medium">{trade.symbol}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            trade.direction === 'LONG' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
                          }`}>{trade.direction}</span>
                          <span className={`text-sm font-medium ml-auto ${trade.pnl > 0 ? 'text-blue-400' : trade.pnl < 0 ? 'text-gray-400' : 'text-gray-500'}`}>
                            {trade.pnl > 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                          </span>
                        </div>
                        {trade.notes && (
                          <p className="mt-1 text-xs text-gray-500 line-clamp-1">{trade.notes}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No trades recorded yet</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate('/journal')}
                    >
                      Log Your First Trade
                    </Button>
                  </div>
                )
              )}

              {activeTab === 'notes' && (
                notes.length > 0 ? (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex gap-4 group p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleToggleNoteRead(note)}
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-2 transition-colors ${
                          note.is_read ? 'bg-gray-600' : 'bg-blue-400 shadow-lg shadow-blue-400/50'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{formatTradeTime(note.created_at)}</span>
                          <span className="text-gray-500">•</span>
                          <span>{formatTradeDate(note.created_at)}</span>
                          {!note.is_read && (
                            <span className="text-blue-400 font-medium">New</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-gray-200">{note.content}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingNote(note);
                          }}
                          className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/5"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-white/5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No notes yet</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setShowAddNote(true);
                        setNoteContent('');
                      }}
                    >
                      Add Your First Note
                    </Button>
                  </div>
                )
              )}
            </div>
          </Card>

          {/* Trading Plan & Confluences */}
          <motion.div variants={fadeInUp} data-tour="trading-plan">
            <Card variant="default" className="bg-[#111]/80 p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex-1">
                <h2 className="text-base font-medium">Trading Plan</h2>
                <div className="flex gap-6 mt-3">
                  <button
                    className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                      planSectionTab === 'confluences'
                        ? 'text-white border-white'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                    onClick={() => setPlanSectionTab('confluences')}
                  >
                    Confluences
                  </button>
                  <button
                    className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                      planSectionTab === 'rules'
                        ? 'text-white border-white'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                    onClick={() => setPlanSectionTab('rules')}
                  >
                    Trading Rules
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {planSectionTab === 'confluences' && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-400/10 border border-blue-400/20">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Avg. Adherence</div>
                        <div className="text-lg font-bold text-blue-400">{averageConfluenceUsage === null ? '--' : `${averageConfluenceUsage}%`}</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={16} />}
                      onClick={() => setShowAddConfluence(true)}
                    >
                      Add
                    </Button>
                  </>
                )}
                {planSectionTab === 'rules' && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-400/10 border border-blue-400/20">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Avg. Adherence</div>
                        <div className="text-lg font-bold text-blue-400">{averageRuleAdherence === null ? '--' : `${averageRuleAdherence}%`}</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={16} />}
                      onClick={() => setShowAddRule(true)}
                    >
                      Add
                    </Button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : (
              <>
                {planSectionTab === 'confluences' && showAddConfluence && (
                  <div className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Add New Confluence</h3>
                      <button
                        onClick={() => {
                          setShowAddConfluence(false);
                          setNewConfluence({ name: '', description: '' });
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Rule name (e.g., EMA Crossover)"
                        value={newConfluence.name}
                        onChange={(e) => setNewConfluence({ ...newConfluence, name: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newConfluence.description}
                        onChange={(e) => setNewConfluence({ ...newConfluence, description: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAddConfluence}
                        disabled={!newConfluence.name.trim()}
                      >
                        Add Confluence
                      </Button>
                    </div>
                  </div>
                )}

                {planSectionTab === 'rules' && showAddRule && (
                  <div className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Add New Trading Rule</h3>
                      <button
                        onClick={() => {
                          setShowAddRule(false);
                          setNewRule({ name: '', description: '', category: 'other' });
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Rule name (e.g., Max 3 trades per day)"
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newRule.description}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      <select
                        value={newRule.category}
                        onChange={(e) => setNewRule({ ...newRule, category: e.target.value as any })}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      >
                        <option value="risk_management">Risk Management</option>
                        <option value="timing">Timing</option>
                        <option value="psychology">Psychology</option>
                        <option value="strategy">Strategy</option>
                        <option value="other">Other</option>
                      </select>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAddRule}
                        disabled={!newRule.name.trim()}
                      >
                        Add Rule
                      </Button>
                    </div>
                  </div>
                )}

                <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {planSectionTab === 'confluences' && (
                    <>
                <div className="space-y-3">
                  {confluences.map((confluence) => (
                    <div
                      key={confluence.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-all group cursor-pointer ${
                        confluence.enabled
                          ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => handleToggleConfluence(confluence)}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        confluence.enabled
                          ? 'border-blue-400 bg-blue-400/20'
                          : 'border-gray-600'
                      }`}>
                        {confluence.enabled && (
                          <div className="w-3 h-3 rounded-sm bg-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-medium transition-colors ${
                          confluence.enabled ? 'text-white' : 'text-gray-400'
                        }`}>{confluence.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{confluence.description}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-gray-400">Usage</div>
                          <div className={`text-sm font-medium ${
                            confluence.enabled ? 'text-blue-400' : 'text-gray-500'
                          }`}>{confluence.usage_rate === null ? '--' : `${confluence.usage_rate}%`}</div>
                        </div>
                        <div className="w-16 h-2 bg-[#222] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-colors ${
                              confluence.enabled
                                ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                                : 'bg-gray-600'
                            }`}
                            style={{ width: `${confluence.usage_rate ?? 0}%` }}
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfluence(confluence.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all p-1.5 rounded hover:bg-white/5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {confluences.length === 0 && !showAddConfluence && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No confluences defined yet</p>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus size={16} />}
                      onClick={() => setShowAddConfluence(true)}
                    >
                      Add Your First Rule
                    </Button>
                  </div>
                )}

                    {confluences.length > 0 && (
                      <div className="mt-5 pt-5 border-t border-white/5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Minimum confluences required</span>
                          <span className="font-medium">
                            {tradingPlanSettings?.min_confluences_required || 3} of {confluences.length}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {planSectionTab === 'rules' && (
                  <>
                    <div className="space-y-3">
                      {tradingRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`flex items-start gap-4 p-4 rounded-lg border transition-all group cursor-pointer ${
                            rule.enabled
                              ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15'
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => handleToggleRule(rule)}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            rule.enabled
                              ? 'border-blue-400 bg-blue-400/20'
                              : 'border-gray-600'
                          }`}>
                            {rule.enabled && (
                              <div className="w-3 h-3 rounded-sm bg-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm font-medium transition-colors ${
                                rule.enabled ? 'text-white' : 'text-gray-400'
                              }`}>{rule.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                                rule.enabled
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-white/5 text-gray-400'
                              }`}>
                                {rule.category.replace('_', ' ')}
                              </span>
                            </div>
                            {rule.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRule(rule.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all p-1.5 rounded hover:bg-white/5"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {tradingRules.length === 0 && !showAddRule && (
                      <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">No trading rules defined yet</p>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Plus size={16} />}
                          onClick={() => setShowAddRule(true)}
                        >
                          Add Your First Rule
                        </Button>
                      </div>
                    )}

                    {tradingRules.length > 0 && (
                      <div className="mt-5 pt-5 border-t border-white/5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Active trading rules</span>
                          <span className="font-medium">
                            {tradingRules.filter(r => r.enabled).length} of {tradingRules.length}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                  )}
                </div>
              </>
            )}
          </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      <TradingReportModal
        report={selectedReport}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

    </div>
  );
}