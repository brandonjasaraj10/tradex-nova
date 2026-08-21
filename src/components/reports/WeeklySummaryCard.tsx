import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, BarChart3, ChevronRight, Eye } from 'lucide-react';
import { TradingReport } from '../../services/reports';

interface WeeklySummaryCardProps {
  report: TradingReport;
  onClick: () => void;
  privacyMode?: boolean;
  delay?: number;
}

export default function WeeklySummaryCard({ report, onClick, privacyMode = false, delay = 0 }: WeeklySummaryCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${day}`;
  };

  const formatWeekRange = (startStr: string, endStr: string) => {
    const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endStr.split('-').map(Number);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[startMonth - 1];

    return `${month} ${startDay}-${endDay}`;
  };

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full h-full min-h-0 bg-gradient-to-br from-[#0A0A0A] to-[#0F0F0F] border border-[#3B82F6]/30 rounded-md p-1.5 lg:p-2 text-left hover:border-[#3B82F6]/60 transition-all group relative overflow-hidden flex flex-col justify-start"
      style={{
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {/*
        The whole card is a button, so the old separate "View >" footer row
        was both redundant and the thing being clipped: with four stat rows
        it pushed past the fixed row height and overflow-hidden cut it off.
        The chevron now lives inline in the header, and the stats area is a
        min-h-0 flex child so it can never shove anything out of the card.
      */}
      <div className="relative z-10 flex flex-col h-full min-h-0 gap-0.5">
        <div className="flex items-center justify-between gap-0.5 flex-shrink-0">
          <span className="text-[9px] lg:text-[10px] whitespace-nowrap font-medium text-gray-400 truncate">
            {formatWeekRange(report.period_start, report.period_end)}
          </span>
          <ChevronRight
            size={10}
            className="lg:w-3 lg:h-3 flex-shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors"
          />
        </div>

        {report.total_trades === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className="text-[10px] lg:text-[11px] text-gray-500">No trades</p>
          </div>
        ) : privacyMode ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <Eye size={10} className="text-gray-600" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <span className="text-[9px] lg:text-[10px] whitespace-nowrap text-gray-400">P&L</span>
              <span className={`text-[11px] lg:text-xs font-bold ${report.total_pnl >= 0 ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
                {report.total_pnl >= 0 ? '+' : ''}{formatCurrency(report.total_pnl)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[9px] lg:text-[10px] whitespace-nowrap text-gray-400">Win Rate</span>
              <span className="text-[11px] lg:text-xs font-bold text-white">{report.win_rate.toFixed(0)}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[9px] lg:text-[10px] whitespace-nowrap text-gray-400">Trades</span>
              <span className="text-[11px] lg:text-xs font-bold text-white">{report.total_trades}</span>
            </div>

            {report.avg_psychology_score > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] lg:text-[10px] whitespace-nowrap text-gray-400">Psych</span>
                <span className="text-[11px] lg:text-xs font-medium text-white">
                  {report.avg_psychology_score.toFixed(0)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}
