import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, Shield, Target, Award, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { NOVAScoreBreakdown } from '../../services/novaScore';
import { formatRatio } from '../../utils/formatMetrics';

interface NOVAScoreProps {
  breakdown: NOVAScoreBreakdown | null;
  size?: 'sm' | 'md' | 'lg';
  showBreakdown?: boolean;
  /*
    What period these figures cover, e.g. "Jul 25 - Aug 23" or "All-time".

    Required context, not decoration. The same metric legitimately differs
    between screens - profit factor was 1.62 all-time and 2.24 over the last
    30 days on one real account - and with both just labelled "Profit
    Factor" the only reasonable conclusion is that one is broken. Naming the
    window is what makes two different numbers understandable instead of
    suspicious.
  */
  periodLabel?: string;
}

/*
  A trade logged as a journal entry for a day carries no entry/exit time, so
  there is genuinely nothing to average. Showing a dash is honest; the
  previous hardcoded "2.4h" was not.
*/
function formatHoldTime(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export default function NOVAScore({
  breakdown,
  size = 'md',
  showBreakdown = true,
  periodLabel
}: NOVAScoreProps) {
  const [expanded, setExpanded] = useState(false);

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'sm': return 'w-20 h-20 text-sm';
      case 'lg': return 'w-32 h-32 text-4xl';
      default: return 'w-24 h-24 text-3xl';
    }
  };

  // Empty state when no data is available
  if (!breakdown) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <div className={`relative ${getSizeClass(size)} flex items-center justify-center opacity-50`}>
          {/* Background circle */}
          <svg className="absolute w-full h-full" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="emptyBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#2D2D2D" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r={size === 'sm' ? 32 : size === 'lg' ? 60 : 45}
              fill="none"
              stroke="url(#emptyBgGradient)"
              strokeWidth="6"
            />
          </svg>

          {/* Empty score display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-0.5">
            <span className="font-bold leading-none text-gray-600 text-3xl">--</span>
            <span className={`${size === 'sm' ? 'text-[7px]' : 'text-[10px]'} text-gray-600 font-medium tracking-wider leading-none`}>NOVA</span>
          </div>
        </div>

        <motion.div
          className="mt-3 flex flex-col items-center gap-1 text-center max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-500">
              NOVA Score
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Add trades or journal entries to calculate your NOVA Score
          </p>
        </motion.div>
      </div>
    );
  }

  /*
    The ring is always brand-blue - BRAND_GUIDE.md's colour for glows and
    gradients - rather than shading by score.

    It used to step through three blues by value (#60A5FA under 40, #3B82F6
    under 70, #2563EB above). As a signal that was close to worthless: three
    shades of the same hue, unlabelled, that nobody can decode into a
    performance tier - and the number sits in the middle of the ring saying
    it outright anyway. What it did do reliably was make a lower score look
    washed out rather than lower, which reads as a rendering fault, not as
    feedback. That became obvious once the score started following the date
    picker and a narrower window dropped it into the palest band.
  */
  const SCORE_RING_COLOR = '#3B82F6';

  /*
    Below this, the score describes a handful of trades rather than a trader.

    It matters more now that the panel follows the date picker: selecting a
    quiet week can leave a single trade in range, and one winning trade
    otherwise renders as a confident "Elite". The score is still shown - it
    is the honest result for that window - but it says what it is standing
    on, so nobody reads a week of luck as a verdict on their trading.
  */
  const MIN_TRADES_FOR_A_MEANINGFUL_SCORE = 10;

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Elite';
    if (score >= 70) return 'Advanced';
    if (score >= 55) return 'Intermediate';
    if (score >= 40) return 'Developing';
    return 'Beginner';
  };

  const sizeClass = getSizeClass(size);
  const scoreColor = SCORE_RING_COLOR;
  const radius = size === 'sm' ? 32 : size === 'lg' ? 60 : 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (breakdown.overall_score / 100) * circumference;
  const innerRadius = radius - 4;

  const scoreMetrics = [
    {
      label: 'Profitability',
      score: breakdown.profitability_score,
      icon: TrendingUp,
      description: 'Win rate, profit factor, and win/loss ratio'
    },
    {
      label: 'Consistency',
      score: breakdown.consistency_score,
      icon: Target,
      description: 'Performance stability across trading periods'
    },
    {
      label: 'Risk Management',
      score: breakdown.risk_management_score,
      icon: Shield,
      description: 'Risk/reward ratios and drawdown control'
    },
    {
      label: 'Discipline',
      score: breakdown.discipline_score,
      icon: Award,
      description: 'Confluence usage and trading plan adherence'
    },
    {
      label: 'Execution',
      score: breakdown.execution_score,
      icon: Zap,
      description: 'Trade timing and trend momentum'
    }
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center">
        <div className={`relative ${sizeClass} flex items-center justify-center`}>
          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-30"
            style={{ backgroundColor: scoreColor }}
          />

          {/* Background circle with gradient */}
          <svg className="absolute w-full h-full" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#2D2D2D" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="url(#bgGradient)"
              strokeWidth="6"
            />
            {/* Inner decorative circle */}
            <circle
              cx="60"
              cy="60"
              r={innerRadius}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>

          {/* Progress circle with gradient */}
          <motion.svg
            className="absolute w-full h-full -rotate-90"
            viewBox="0 0 120 120"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: -90 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={scoreColor} stopOpacity="0.8" />
                <stop offset="100%" stopColor={scoreColor} stopOpacity="1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              filter="url(#glow)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
            />
          </motion.svg>

          {/* Score display */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-0.5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            <span
              className="font-bold leading-none"
              style={{
                color: scoreColor,
                textShadow: `0 0 20px ${scoreColor}50`
              }}
            >
              {breakdown.overall_score}
            </span>
            <span className={`${size === 'sm' ? 'text-[7px]' : 'text-[10px]'} text-gray-500 font-medium tracking-wider leading-none`}>NOVA</span>
          </motion.div>

          {/* Sparkle particles for high scores */}
          {breakdown.overall_score >= 70 && (
            <>
              <motion.div
                className={`absolute rounded-full ${size === 'lg' ? 'w-2 h-2' : 'w-1 h-1'}`}
                style={{ backgroundColor: scoreColor, top: '10%', right: '20%' }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className={`absolute rounded-full ${size === 'lg' ? 'w-2 h-2' : 'w-1 h-1'}`}
                style={{ backgroundColor: scoreColor, bottom: '15%', left: '25%' }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
              />
              <motion.div
                className={`absolute rounded-full ${size === 'lg' ? 'w-2 h-2' : 'w-1 h-1'}`}
                style={{ backgroundColor: scoreColor, top: '25%', left: '15%' }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1.4 }}
              />
            </>
          )}
        </div>

        <motion.div
          className="mt-3 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-gold-400" />
            <p className="text-sm font-medium text-gold-400">
              NOVA Score
            </p>
          </div>
          <p className="text-xs text-gray-400">
            {breakdown.total_trades < MIN_TRADES_FOR_A_MEANINGFUL_SCORE
              ? `Based on ${breakdown.total_trades} ${breakdown.total_trades === 1 ? 'trade' : 'trades'}`
              : getScoreLabel(breakdown.overall_score)}
          </p>
          {/*
            Shown on the compact score too, not just the expanded breakdown.

            The same account reads 35 on the Nova page, 27 on Analytics and
            "--" on the Dashboard, because each page covers a different window
            - this week, the last 30 days, and everything. One calculation,
            three windows, and until every one of them names its window that
            looks like three broken scores rather than three answers to three
            different questions.
          */}
          {periodLabel && (
            <p className="text-[10px] text-gray-500">{periodLabel}</p>
          )}
        </motion.div>
      </div>

      {showBreakdown && (
        <motion.div
          className="mt-6 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.8 }}
        >
          <motion.button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 transition-all border border-white/10 relative overflow-hidden group"
            animate={{ width: expanded ? '100%' : '400px' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 relative z-10">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-200">Score Breakdown</span>
            </div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              <ChevronDown size={16} className="text-blue-400" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden w-full"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                  <div className="space-y-3">
                  {scoreMetrics.map((metric, index) => {
                    const metricColor = SCORE_RING_COLOR;
                    return (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 transition-all border border-white/10 relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5" />
                        </div>
                        <div className="flex items-center justify-between mb-2 relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-white/5 border border-white/10">
                              <metric.icon size={12} style={{ color: metricColor }} />
                            </div>
                            <span className="text-xs font-medium">{metric.label}</span>
                          </div>
                          <span
                            className="text-sm font-bold"
                            style={{
                              color: metricColor,
                              textShadow: `0 0 10px ${metricColor}40`
                            }}
                          >
                            {metric.score}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden relative border border-white/5 mb-2">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metric.score}%` }}
                            transition={{ duration: 1.5, delay: 0.5 + index * 0.1, ease: "easeOut" }}
                            className="h-full rounded-full relative"
                            style={{
                              background: `linear-gradient(90deg, ${metricColor}80, ${metricColor})`,
                              boxShadow: `0 0 10px ${metricColor}60`
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                          </motion.div>
                        </div>
                        <p className="text-[10px] text-gray-400 relative z-10 leading-tight">{metric.description}</p>
                      </motion.div>
                    );
                  })}
                  </div>

                  <motion.div
                    className="p-4 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10 relative overflow-hidden"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                    {/*
                      State the period.

                      These figures are all-time, while the stat tiles on the
                      Dashboard and Analytics are scoped to whatever date
                      range is selected. Both are correct and they legitimately
                      differ - a real account showed profit factor 1.62 here
                      across 20 trades and 2.24 on the Analytics tile across
                      the last 10 - but with both labelled simply "Profit
                      Factor" the only reasonable conclusion was that one of
                      them was broken. The score is deliberately all-time
                      because it is a competency measure, so the fix is to say
                      which window each number covers.
                    */}
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                        <Target size={14} className="text-blue-400" />
                        Performance Metrics
                      </h4>
                      {periodLabel && (
                        <p className="text-[10px] text-gray-500 mt-0.5 ml-[22px]">{periodLabel}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Win Rate</p>
                        <p className="font-bold text-white mt-1 text-sm">{breakdown.win_rate.toFixed(1)}%</p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Profit Factor</p>
                        <p className="font-bold text-white mt-1 text-sm">{formatRatio(breakdown.profit_factor, breakdown.total_trades)}</p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Avg W/L</p>
                        <p className="font-bold text-white mt-1 text-sm">{formatRatio(breakdown.avg_win_loss_ratio, breakdown.total_trades)}</p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Total Trades</p>
                        <p className="font-bold text-white mt-1 text-sm">{breakdown.total_trades}</p>
                      </motion.div>
                    </div>
                    <div className="border-t border-white/10 pt-3 grid grid-cols-2 gap-3 text-xs">
                      {/*
                        Every figure here is now read off the trades.

                        These four used to be derived from the summary numbers
                        beside them and did not mean what they said: Best Trade
                        was max(win_rate, profit_factor) shown as a percentage,
                        Success Streak was win_rate / 10 - which is why a single
                        trade reported a 10-trade streak - Monthly Growth was
                        profit_factor x 12, and Avg Hold Time was the constant
                        "2.4h" for every user regardless of their trades.
                      */}
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Best Trade</p>
                        <p className={`font-bold mt-1 text-sm ${breakdown.best_trade >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                          {formatMoney(breakdown.best_trade)}
                        </p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Worst Trade</p>
                        <p className={`font-bold mt-1 text-sm ${breakdown.worst_trade >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                          {formatMoney(breakdown.worst_trade)}
                        </p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Best Win Streak</p>
                        <p className="font-bold text-white mt-1 text-sm">
                          {breakdown.longest_win_streak} {breakdown.longest_win_streak === 1 ? 'trade' : 'trades'}
                        </p>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }}>
                        <p className="text-gray-400 text-[10px]">Avg Hold Time</p>
                        <p className="font-bold text-white mt-1 text-sm">{formatHoldTime(breakdown.avg_hold_minutes)}</p>
                      </motion.div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
