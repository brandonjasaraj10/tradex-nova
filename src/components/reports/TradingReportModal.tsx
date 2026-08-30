import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { X, TrendingUp, TrendingDown, Target, Award, AlertCircle, Calendar, Clock, BarChart3, Activity, CheckCircle2, Sparkles } from 'lucide-react';
import { TradingReport } from '../../services/reports';

interface TradingReportModalProps {
  report: TradingReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TradingReportModal({ report, isOpen, onClose }: TradingReportModalProps) {
  useBodyScrollLock(isOpen);
  if (!report) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${day}, ${year}`;
  };

  const formatDateRange = () => {
    const [startYear, startMonth, startDay] = report.period_start.split('-').map(Number);
    const [endYear, endMonth, endDay] = report.period_end.split('-').map(Number);

    // For weekly reports, show as "Jan 1-7, 2024"
    if (report.report_type === 'weekly') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[startMonth - 1];

      return `${month} ${startDay}-${endDay}, ${startYear}`;
    }

    // For other types, show full date range
    return `${formatDate(report.period_start)} - ${formatDate(report.period_end)}`;
  };

  const getReportTitle = () => {
    const typeMap = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return `${typeMap[report.report_type]} Trading Report`;
  };

  const getInsightColor = (type: string) => {
    const colorMap: Record<string, string> = {
      positive: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30',
      warning: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30',
      critical: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
      neutral: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
      info: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30'
    };
    return colorMap[type] || colorMap.neutral;
  };

  const getInsightIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      positive: Award,
      warning: AlertCircle,
      critical: AlertCircle,
      neutral: Activity,
      info: Activity
    };
    const Icon = iconMap[type] || Activity;
    return Icon;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-[#0A0A0A] to-[#0F0F0F] border border-[#3B82F6]/30 rounded-2xl w-full max-w-[95vw] sm:max-w-6xl max-h-[90dvh] overflow-hidden flex flex-col"
            style={{
              boxShadow: '0 0 40px rgba(59, 130, 246, 0.2), inset 0 0 60px rgba(59, 130, 246, 0.05)',
            }}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-[#3B82F6]" />
                  {getReportTitle()}
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  {formatDateRange()}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {report.total_trades === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Trading Activity</h3>
                  <p className="text-gray-400">No trades were recorded during this period</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Total P&L</span>
                        {report.total_pnl >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <p className={`text-2xl font-bold ${report.total_pnl >= 0 ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
                        {formatCurrency(report.total_pnl)}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Win Rate</span>
                        <Target className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <p className="text-2xl font-bold text-white">{report.win_rate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {report.winning_trades}W / {report.losing_trades}L
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Risk:Reward</span>
                        <Activity className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {report.risk_reward_ratio > 0 ? report.risk_reward_ratio.toFixed(2) : '0.00'}:1
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Total Trades</span>
                        <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <p className="text-2xl font-bold text-white">{report.total_trades}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {report.total_trading_days} trading days
                      </p>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white/5 rounded-xl p-5 border border-white/10"
                    >
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#3B82F6]" />
                        Key Insights
                      </h3>
                      <div className="space-y-3">
                        {report.key_insights.map((insight, idx) => {
                          const Icon = getInsightIcon(insight.type);
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${getInsightColor(insight.type)}`}
                            >
                              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                              <p className="text-sm">{insight.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                      className="bg-white/5 rounded-xl p-5 border border-white/10"
                    >
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#3B82F6]" />
                        Performance Metrics
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Average Win</span>
                          <span className="text-sm font-medium text-[#3B82F6]">{formatCurrency(report.avg_win)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Average Loss</span>
                          <span className="text-sm font-medium text-gray-400">{formatCurrency(report.avg_loss < 0 ? report.avg_loss : -report.avg_loss)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Best Trade</span>
                          <span className="text-sm font-medium text-[#3B82F6]">{formatCurrency(report.best_trade)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Worst Trade</span>
                          <span className="text-sm font-medium text-gray-400">{formatCurrency(report.worst_trade < 0 ? report.worst_trade : -report.worst_trade)}</span>
                        </div>
                        {report.best_trading_day && (
                          <div className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-sm text-gray-400">Best Day</span>
                            <span className="text-sm font-medium text-white">{formatDate(report.best_trading_day)}</span>
                          </div>
                        )}
                        {report.worst_trading_day && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-400">Worst Day</span>
                            <span className="text-sm font-medium text-white">{formatDate(report.worst_trading_day)}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {report.most_traded_pairs.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 rounded-xl p-5 border border-white/10"
                      >
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Target className="w-5 h-5 text-[#3B82F6]" />
                          Most Traded Pairs
                        </h3>
                        <div className="space-y-3">
                          {report.most_traded_pairs.map((pair, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">{pair.pair}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#3B82F6]"
                                    style={{
                                      width: `${(pair.count / report.total_trades) * 100}%`
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-white w-12 text-right">
                                  {pair.count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                      className="bg-white/5 rounded-xl p-5 border border-white/10"
                    >
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-[#3B82F6]" />
                        Trading Discipline
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Rule Compliance</span>
                            <span className="text-sm font-medium text-white">
                              {report.rule_compliance_rate.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full"
                              style={{ width: `${report.rule_compliance_rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Win Streak</div>
                            <div className="text-lg font-bold text-[#3B82F6]">{report.largest_win_streak}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Loss Streak</div>
                            <div className="text-lg font-bold text-gray-400">{report.largest_loss_streak}</div>
                          </div>
                        </div>
                        {report.avg_psychology_score > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-400">Avg Psychology Score</span>
                              <span className="text-lg font-bold text-white">
                                {report.avg_psychology_score.toFixed(1)}/100
                              </span>
                            </div>
                          </div>
                        )}
                        {report.avg_trade_duration > 0 && (
                          <div className="pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-400 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Avg Trade Duration
                              </span>
                              <span className="text-sm font-medium text-white">
                                {Math.floor(report.avg_trade_duration)} min
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {Object.keys(report.session_breakdown).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="bg-white/5 rounded-xl p-5 border border-white/10"
                    >
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#3B82F6]" />
                        Session Breakdown
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(report.session_breakdown).map(([session, data]) => (
                          <div key={session} className="bg-white/5 rounded-lg p-4">
                            <div className="text-sm text-gray-400 mb-2">{session}</div>
                            <div className="text-xl font-bold text-white mb-1">
                              {data.trades} trades
                            </div>
                            <div className={`text-sm font-medium ${data.pnl >= 0 ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
                              {formatCurrency(data.pnl)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
