import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Target, Activity, Zap, Brain, AlertTriangle, CheckCircle2, Award, TrendingDown, Package, HelpCircle, X, Sparkles } from 'lucide-react';
import Card from '../components/shared/Card';
import Button from '../components/shared/Button';
import NOVAScore from '../components/shared/NOVAScore';
import DateRangePicker from '../components/shared/DateRangePicker';
import AccountSelector from '../components/shared/AccountSelector';
import { useAccount } from '../lib/accountContext';
import { useDataSync } from '../lib/dataSync';
import { getTradeStats, getTradesForCharts } from '../services/trades';
import { calculateNOVAScore, type NOVAScoreBreakdown } from '../services/novaScore';
import type { TradeStats } from '../types/trade';
import { useAuth } from '../lib/auth';
import { generateInsights, getActiveInsights, dismissInsight, type Insight } from '../services/insights';
import { supabase } from '../lib/supabase';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#1A1A1A',
      titleColor: '#FFFFFF',
      bodyColor: '#CCCCCC',
      borderColor: '#2D2D2D',
      borderWidth: 1,
      padding: 10,
      boxPadding: 5,
      usePointStyle: true,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#888888' },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#888888' },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 5 },
  },
};

export default function Analytics() {
  const { accounts, selectedAccount, setSelectedAccount, refreshAccounts } = useAccount();
  const { refreshTrigger } = useDataSync();
  const { user } = useAuth();

  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 29);
    return { startDate, endDate };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [novaScore, setNovaScore] = useState<NOVAScoreBreakdown | null>(null);
  const [rawTrades, setRawTrades] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [stats, trades] = await Promise.all([
          getTradeStats([dateRange.startDate, dateRange.endDate], selectedAccount?.id),
          getTradesForCharts([dateRange.startDate, dateRange.endDate], selectedAccount?.id),
        ]);
        setTradeStats(stats);
        setRawTrades(trades);
      } catch (error) {
        console.error('Error fetching trade data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange, selectedAccount, refreshTrigger]);

  useEffect(() => {
    const loadInsights = async () => {
      if (user) {
        setLoadingInsights(true);
        try {
          const existingInsights = await getActiveInsights(user.id);
          if (existingInsights.length > 0 && refreshTrigger === 0) {
            setInsights(existingInsights);
          } else {
            const newInsights = await generateInsights(user.id, refreshTrigger > 0);
            setInsights(newInsights);
          }
        } catch (error) {
          console.error('Error loading insights:', error);
        } finally {
          setLoadingInsights(false);
        }
      }
    };
    loadInsights();
  }, [user, refreshTrigger]);

  useEffect(() => {
    const loadNovaScore = async () => {
      if (!user) return;
      try {
        const { data: tradesData, error: tradesError } = await supabase
          .from('trades')
          .select('pnl, entry_date, exit_date, created_at')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false })
          .limit(100);

        if (tradesError) throw tradesError;

        const { data: journalData, error: journalError } = await supabase
          .from('journal_entries')
          .select('manual_pnl, entry_date, created_at')
          .eq('user_id', user.id)
          .not('manual_pnl', 'is', null)
          .order('entry_date', { ascending: false })
          .limit(100);

        if (journalError) throw journalError;

        const tradeItems = (tradesData || []).map((t: any) => ({
          profit_loss: t.pnl || 0,
          entry_time: t.entry_date || t.created_at,
          exit_time: t.exit_date || t.entry_date || t.created_at,
        }));

        const journalItems = (journalData || [])
          .map((e: any) => ({
            profit_loss: e.manual_pnl ?? 0,
            entry_time: e.entry_date || e.created_at,
            exit_time: e.entry_date || e.created_at,
          }));

        const allTrades = [...tradeItems, ...journalItems];
        if (allTrades.length > 0) {
          const score = await calculateNOVAScore(allTrades);
          setNovaScore(score);
        }
      } catch (error) {
        console.error('Error loading NOVA score:', error);
      }
    };
    loadNovaScore();
  }, [user, refreshTrigger]);

  const pnlChartData = useMemo(() => {
    if (rawTrades.length === 0) {
      return {
        labels: ['No data'],
        datasets: [{ label: 'Daily P&L', data: [0], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true }],
      };
    }

    const dailyMap = new Map<string, number>();
    rawTrades.forEach(t => {
      const date = (t.entry_date || '').split('T')[0];
      if (!date) return;
      dailyMap.set(date, (dailyMap.get(date) || 0) + t.pnl);
    });

    const sorted = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const labels = sorted.map(([d]) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = sorted.map(([, pnl]) => {
      cumulative += pnl;
      return Number(cumulative.toFixed(2));
    });

    return {
      labels,
      datasets: [{
        label: 'Cumulative P&L',
        data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }],
    };
  }, [rawTrades]);

  const winRateChartData = useMemo(() => {
    if (rawTrades.length === 0) {
      return {
        labels: ['No data'],
        datasets: [{ label: 'Win Rate (%)', data: [0], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true }],
      };
    }

    const weeklyMap = new Map<string, { wins: number; total: number }>();
    rawTrades.forEach(t => {
      const date = new Date((t.entry_date || '').split('T')[0] + 'T00:00:00');
      if (isNaN(date.getTime())) return;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split('T')[0];
      const existing = weeklyMap.get(key) || { wins: 0, total: 0 };
      existing.total++;
      if (t.pnl > 0) existing.wins++;
      weeklyMap.set(key, existing);
    });

    const sorted = Array.from(weeklyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([d]) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = sorted.map(([, s]) => s.total > 0 ? Number(((s.wins / s.total) * 100).toFixed(1)) : 0);

    return {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }],
    };
  }, [rawTrades]);

  const symbolChartData = useMemo(() => {
    const symbolMap = new Map<string, number>();
    rawTrades.forEach(t => {
      if (!t.symbol) return;
      symbolMap.set(t.symbol, (symbolMap.get(t.symbol) || 0) + t.pnl);
    });

    const sorted = Array.from(symbolMap.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10);

    return {
      labels: sorted.length > 0 ? sorted.map(([s]) => s) : ['No data'],
      datasets: [{
        label: 'P&L by Symbol',
        data: sorted.length > 0 ? sorted.map(([, pnl]) => Number(pnl.toFixed(2))) : [0],
        backgroundColor: sorted.map(([, pnl]) => pnl >= 0 ? '#3B82F6' : '#6B7280'),
        borderWidth: 1,
      }],
    };
  }, [rawTrades]);

  const tradeTypeChartData = useMemo(() => {
    const longCount = rawTrades.filter(t => t.direction === 'LONG').length;
    const shortCount = rawTrades.filter(t => t.direction === 'SHORT').length;
    const total = longCount + shortCount;

    return {
      labels: ['Long', 'Short'],
      datasets: [{
        label: 'Trade Types',
        data: total > 0 ? [longCount, shortCount] : [1, 0],
        backgroundColor: ['#3B82F6', '#60A5FA'],
        borderWidth: 0,
      }],
    };
  }, [rawTrades]);

  const weekdayChartData = useMemo(() => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayMap = new Map<number, { pnl: number; count: number }>();

    rawTrades.forEach(t => {
      const date = new Date((t.entry_date || '').split('T')[0] + 'T00:00:00');
      if (isNaN(date.getTime())) return;
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return;
      const existing = dayMap.get(dow) || { pnl: 0, count: 0 };
      existing.pnl += t.pnl;
      existing.count++;
      dayMap.set(dow, existing);
    });

    const data = [1, 2, 3, 4, 5].map(d => {
      const entry = dayMap.get(d);
      return entry && entry.count > 0 ? Number((entry.pnl / entry.count).toFixed(2)) : 0;
    });

    return {
      labels: dayNames,
      datasets: [{
        label: 'Average P&L by Day',
        data,
        backgroundColor: '#3B82F6',
        borderRadius: 6,
      }],
    };
  }, [rawTrades]);

  const handleDismissInsight = async (insightId: string) => {
    try {
      await dismissInsight(insightId);
      setInsights(insights.filter(insight => insight.id !== insightId));
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const getInsightIconComponent = (type: string) => {
    const iconMap: Record<string, any> = {
      performance: Award,
      risk: AlertTriangle,
      opportunity: Zap,
      pattern: Activity,
      discipline: CheckCircle2,
      psychology: Brain,
      consistency: Target
    };
    return iconMap[type] || Activity;
  };

  const getInsightColor = (category: string) => {
    const colorMap: Record<string, string> = {
      positive: 'text-blue-400',
      warning: 'text-blue-400',
      neutral: 'text-gray-400',
      critical: 'text-gray-400'
    };
    return colorMap[category] || 'text-gray-400';
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.08 } }
        }}
      >
        <motion.div variants={fadeInUp} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pt-6" data-tour="analytics-header">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-transparent to-transparent blur-xl" />
            <div className="relative">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">Analytics</h1>
              <p className="text-gray-400 mt-2 text-sm">Deep insights into your trading performance</p>
            </div>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <AccountSelector
              accounts={accounts}
              selectedAccount={selectedAccount}
              onAccountChange={setSelectedAccount}
              onAccountsUpdate={refreshAccounts}
            />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-3" data-tour="analytics-nova-score">
            <Card variant="gradient" className="p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="relative flex flex-col items-center justify-center h-full">
              <div className="scale-75 -mt-2">
                <NOVAScore
                  breakdown={novaScore}
                  size="md"
                  showBreakdown={false}
                />
              </div>
            </div>
          </Card>
          </div>

          <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
              <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
                <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-all duration-300 ${loading ? 'from-gray-500/0 via-gray-500/5 to-gray-500/0' : tradeStats && tradeStats.total_pnl >= 0 ? 'from-blue-500/0 via-blue-500/5 to-blue-500/0' : 'from-gray-500/0 via-gray-500/5 to-gray-500/0'}`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${tradeStats && tradeStats.total_pnl >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-500/10 border-gray-500/20'} border`}>
                      <DollarSign className={`w-4 h-4 ${tradeStats && tradeStats.total_pnl >= 0 ? 'text-blue-400' : 'text-gray-400'}`} />
                    </div>
                  </div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">Total P&L</h3>
                  <p className={`text-2xl font-bold ${loading ? 'text-gray-400' : tradeStats && tradeStats.total_pnl >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {loading ? '...' : tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.total_pnl) : '$0'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">{tradeStats?.total_trades || 0} trades</p>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
              <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Target className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">Win Rate</h3>
                  <p className="text-2xl font-bold text-blue-400">
                    {loading ? '...' : tradeStats ? `${tradeStats.win_rate.toFixed(1)}%` : '0%'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {loading ? '...' : tradeStats ? `${tradeStats.winning_trades}/${tradeStats.total_trades} trades` : '0/0 trades'}
                  </p>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
              <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">Profit Factor</h3>
                  <p className="text-2xl font-bold text-blue-400">
                    {loading ? '...' : tradeStats ? (tradeStats.profit_factor === Infinity ? '---' : tradeStats.profit_factor.toFixed(2)) : '0'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Winners/Losers</p>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
              <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Activity className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">Avg Win/Loss</h3>
                  <p className="text-2xl font-bold text-blue-400">
                    {loading ? '...' : tradeStats && tradeStats.average_loss !== 0 ?
                      `${(tradeStats.average_win / Math.abs(tradeStats.average_loss)).toFixed(1)}:1` :
                      '0:1'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Risk/reward</p>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
            <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors cursor-help" />
                    <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Average profit per winning trade
                    </div>
                  </div>
                </div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">Average Profit</h3>
                <p className="text-2xl font-bold text-blue-400">
                  {loading ? '...' : tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.average_win) : '$0'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Per winning trade</p>
              </div>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
            <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-gray-500/10 border border-gray-500/20">
                    <TrendingDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors cursor-help" />
                    <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Average loss per losing trade
                    </div>
                  </div>
                </div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">Average Loss</h3>
                <p className="text-2xl font-bold text-gray-400">
                  {loading ? '...' : tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.average_loss) : '$0'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Per losing trade</p>
              </div>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
            <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors cursor-help" />
                    <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Total number of trades executed in the period
                    </div>
                  </div>
                </div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">Number of Trades</h3>
                <p className="text-2xl font-bold text-blue-400">
                  {loading ? '...' : tradeStats ? tradeStats.total_trades.toLocaleString() : '0'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Total executed</p>
              </div>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.2 }}>
            <Card variant="default" className="p-5 relative overflow-hidden group cursor-pointer">
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors cursor-help" />
                    <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Largest single winning trade in the period
                    </div>
                  </div>
                </div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">Best Trade</h3>
                <p className="text-2xl font-bold text-blue-400">
                  {loading ? '...' : tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.largest_win) : '$0'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Largest win</p>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" data-tour="analytics-charts">
          <Card title="Cumulative P&L" variant="default" className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="h-80">
              <Line data={pnlChartData} options={{
                ...commonOptions,
                plugins: {
                  ...commonOptions.plugins,
                  tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                      label: function(context: any) {
                        return `P&L: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`;
                      },
                    },
                  },
                },
              }} />
            </div>
          </Card>

          <Card title="Win Rate Trend" variant="default" className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="h-80">
              <Line data={winRateChartData} options={{
                ...commonOptions,
                plugins: {
                  ...commonOptions.plugins,
                  tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                      label: function(context: any) {
                        return `Win Rate: ${context.parsed.y}%`;
                      },
                    },
                  },
                },
              }} />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card title="P&L by Symbol" variant="default" className="lg:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="h-80">
              <Bar data={symbolChartData} options={{
                ...commonOptions,
                plugins: {
                  ...commonOptions.plugins,
                  tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                      label: function(context: any) {
                        return `P&L: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`;
                      },
                    },
                  },
                },
              }} />
            </div>
          </Card>

          <Card title="Trade Types" variant="default" className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="h-80 flex items-center justify-center">
              <Pie data={tradeTypeChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#CCCCCC', font: { size: 12 }, padding: 20 },
                  },
                  tooltip: {
                    backgroundColor: '#1A1A1A',
                    titleColor: '#FFFFFF',
                    bodyColor: '#CCCCCC',
                    borderColor: '#2D2D2D',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 5,
                    usePointStyle: true,
                    callbacks: {
                      label: function(context: any) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((acc: number, data: number) => acc + data, 0);
                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                        return `${label}: ${percentage}% (${value} trades)`;
                      },
                    },
                  },
                },
              }} />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card title="Average P&L by Day of Week" variant="default" className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="h-80">
              <Bar data={weekdayChartData} options={{
                ...commonOptions,
                plugins: {
                  ...commonOptions.plugins,
                  tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                      label: function(context: any) {
                        return `Avg P&L: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`;
                      },
                    },
                  },
                },
              }} />
            </div>
          </Card>

          <Card variant="default" className="p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <h3 className="text-sm font-medium text-white mb-4">Performance Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Largest Win</span>
                <span className="text-sm font-medium text-blue-400">
                  {tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.largest_win) : '$0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Largest Loss</span>
                <span className="text-sm font-medium text-gray-400">
                  {tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.largest_loss) : '$0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Avg Win</span>
                <span className="text-sm font-medium text-blue-400">
                  {tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.average_win) : '$0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Avg Loss</span>
                <span className="text-sm font-medium text-gray-400">
                  {tradeStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tradeStats.average_loss) : '$0'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Winning Trades</span>
                <span className="text-sm font-medium text-white">{tradeStats?.winning_trades || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-gray-400">Losing Trades</span>
                <span className="text-sm font-medium text-white">{tradeStats?.losing_trades || 0}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="mb-8" data-tour="analytics-insights">
          <Card variant="gradient" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">NOVA Trading Insights</h3>
                  <p className="text-xs text-gray-400 mt-0.5">AI-powered analysis of your trading patterns</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {loadingInsights ? (
                  <div className="col-span-full flex items-center justify-center py-8">
                    <div className="text-center">
                      <motion.div
                        className="w-8 h-8 mx-auto mb-2 rounded-lg bg-blue-400/20 flex items-center justify-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                      </motion.div>
                      <p className="text-xs text-gray-400">Generating insights...</p>
                    </div>
                  </div>
                ) : insights.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-sm text-gray-400 mb-2">No insights available yet</p>
                    <p className="text-xs text-gray-500">Log more trades to get personalized insights</p>
                  </div>
                ) : (
                  insights.slice(0, 3).map((insight) => {
                    const IconComponent = getInsightIconComponent(insight.insight_type);
                    return (
                      <motion.div
                        key={insight.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className="p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-xl border border-blue-500/20 relative overflow-hidden group cursor-pointer"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                              <IconComponent className={`w-4 h-4 ${getInsightColor(insight.category)}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-blue-400 mb-1">{insight.title}</h4>
                              <p className="text-xs text-gray-300 leading-relaxed">
                                {insight.description}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDismissInsight(insight.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                              title="Dismiss insight"
                            >
                              <X className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
