import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Minus, Calendar, Award, Target, Zap } from 'lucide-react';
import Card from './Card';
import { getPsychologyScores, type PsychologyScoreAggregates, type TimeFrame } from '../../services/psychologyScore';
import { useNavigate } from 'react-router-dom';
import { useDataSync } from '../../lib/dataSync';
import { supabase } from '../../lib/supabase';

const TIMEFRAMES: { value: TimeFrame; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'all', label: 'All Time' },
];

// Shown when the user has journaled before but this particular window is
// empty - a normal, expected state (a rest day, a quiet week), not a
// reason to throw the whole card away and show first-run onboarding.
const EMPTY_COPY: Record<TimeFrame, { title: string; body: string }> = {
  daily: {
    title: 'Nothing logged today',
    body: 'Your mindset before and after the session is the part most traders never write down. Two minutes now is worth a lot later.',
  },
  weekly: {
    title: 'A quiet week so far',
    body: 'No psychology entries this week yet. Even a flat, uneventful week is worth noting - it is a baseline to compare against.',
  },
  monthly: {
    title: 'No entries this month',
    body: 'Nothing logged for this month yet. Patterns show up over weeks, so it is worth getting a few entries down.',
  },
  all: {
    title: 'No psychology entries yet',
    body: 'Once you start logging how you felt around your trades, your score and trends will build up here.',
  },
};

export default function PsychologyScore() {
  const navigate = useNavigate();
  const { refreshTrigger } = useDataSync();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');
  const [data, setData] = useState<PsychologyScoreAggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTrades, setHasTrades] = useState(false);
  const [hasAnyEntries, setHasAnyEntries] = useState(false);

  useEffect(() => {
    loadScores();
  }, [timeFrame, refreshTrigger]);

  const loadScores = async () => {
    setLoading(true);
    try {
      const scores = await getPsychologyScores(timeFrame);
      setData(scores);

      if (scores.totalEntries > 0) {
        setHasAnyEntries(true);
      } else {
        // An empty timeframe is not the same as "never journaled". Without
        // this check, picking "Today" on a day with no entry replaced the
        // entire card - timeframe toggle included - with the first-run
        // onboarding screen, leaving no way back to Week/Month/All Time.
        const allTime = timeFrame === 'all' ? scores : await getPsychologyScores('all');
        setHasAnyEntries(allTime.totalEntries > 0);

        if (allTime.totalEntries === 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: trades } = await supabase
              .from('trades')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);

            setHasTrades((trades?.length || 0) > 0);
          }
        }
      }
    } catch (error) {
      console.error('Error loading psychology scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-blue-400';
    if (score >= 50) return 'text-blue-400';
    return 'text-slate-300';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-gradient-to-br from-blue-500/15 via-blue-400/10 to-transparent border-blue-400/40 shadow-lg shadow-blue-500/10';
    if (score >= 50) return 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent border-blue-400/30';
    return 'bg-gradient-to-br from-slate-600/10 via-gray-600/8 to-zinc-600/5 border-slate-500/25';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-blue-400 to-blue-600';
    if (score >= 50) return 'from-blue-400 to-blue-600';
    return 'from-slate-400 to-gray-500';
  };

  const getTrendIcon = () => {
    if (!data) return null;

    switch (data.trend) {
      case 'up':
        return <TrendingUp size={16} className="text-blue-400" />;
      case 'down':
        return <TrendingDown size={16} className="text-slate-300" />;
      default:
        return <Minus size={16} className="text-gray-400" />;
    }
  };

  const getTrendText = () => {
    if (!data || data.trend === 'stable') return 'No change';
    return `${data.trend === 'up' ? '+' : '-'}${data.trendPercentage}%`;
  };

  if (loading) {
    return (
      <Card variant="gradient" className="bg-gradient-to-br from-[#111]/80 to-[#111]/60 p-5 h-full">
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Brain className="w-8 h-8 text-blue-400" />
            </motion.div>
            <p className="text-sm text-gray-400">Loading psychology data...</p>
          </div>
        </div>
      </Card>
    );
  }

  // Only take over the whole card for a genuine first-time user. Someone
  // who has journaled before just has a quiet timeframe, and needs to keep
  // the toggle so they can look at another one.
  if (!data || (data.totalEntries === 0 && !hasAnyEntries)) {
    return (
      <Card variant="gradient" className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5 border border-blue-500/20 h-full">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-400/10 flex items-center justify-center mb-4">
            <Brain className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">Track Your Psychology</h3>
          <p className="text-gray-400 mb-6 max-w-md">
            {hasTrades
              ? "You have trades logged! Add psychology journal entries to track your mental game and emotional patterns during trading."
              : "Start logging your trading psychology to see trends and insights about your mental game over time."}
          </p>
          <button
            onClick={() => navigate('/journal')}
            className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl font-medium transition-colors"
          >
            {hasTrades ? 'Add Psychology Entry' : 'Create First Entry'}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="gradient" className="bg-gradient-to-br from-[#111]/80 to-[#111]/60 p-5 h-full flex flex-col">
      <div className="flex flex-col h-full">
        {/*
          Wraps on a phone. The title block and the Today/Week/Month/All Time
          selector together exceeded 375px, so the selector hung off the right
          edge and dragged the document width with it.
        */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-medium">Psychology Score</h2>
              <p className="text-xs text-gray-400">Mental & emotional performance</p>
            </div>
          </div>

          <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeFrame(tf.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeFrame === tf.value
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {data.totalEntries === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="w-14 h-14 rounded-2xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mb-4"
            >
              <Calendar className="w-6 h-6 text-blue-400" />
            </motion.div>
            <h3 className="text-base font-medium mb-1">{EMPTY_COPY[timeFrame].title}</h3>
            <p className="text-sm text-gray-400 mb-5 max-w-xs">{EMPTY_COPY[timeFrame].body}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/journal')}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
              >
                Log today's mindset
              </button>
              {timeFrame !== 'all' && (
                <button
                  onClick={() => setTimeFrame('all')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  See all time
                </button>
              )}
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-xl border ${getScoreBg(data.average)} relative overflow-hidden group`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 via-blue-400/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Average Score</p>
                  <div className="flex items-center gap-3">
                    <motion.span
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className={`text-5xl font-bold ${getScoreColor(data.average)}`}
                    >
                      {data.average}
                    </motion.span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon()}
                      <span className={`text-sm font-medium ${
                        data.trend === 'up' ? 'text-blue-400' :
                        data.trend === 'down' ? 'text-slate-300' : 'text-gray-400'
                      }`}>
                        {getTrendText()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-24 h-24 relative">
                  <motion.div
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="8"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="url(#scoreGradient)"
                        strokeWidth="8"
                        strokeDasharray={`${(data.average / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                        initial={{ strokeDasharray: '0 251.2' }}
                        animate={{ strokeDasharray: `${(data.average / 100) * 251.2} 251.2` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={data.average >= 70 ? '#60a5fa' : data.average >= 50 ? '#60a5fa' : '#94a3b8'} />
                          <stop offset="100%" stopColor={data.average >= 70 ? '#2563eb' : data.average >= 50 ? '#2563eb' : '#6b7280'} />
                        </linearGradient>
                      </defs>
                    </svg>
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Brain size={32} className={getScoreColor(data.average)} />
                  </motion.div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="grid grid-cols-3 gap-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <p className="text-xs text-gray-400 mb-1">Highest</p>
                    <p className={`text-lg font-bold ${getScoreColor(data.highest)}`}>{data.highest}</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <p className="text-xs text-gray-400 mb-1">Lowest</p>
                    <p className={`text-lg font-bold ${getScoreColor(data.lowest)}`}>{data.lowest}</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <p className="text-xs text-gray-400 mb-1">Entries</p>
                    <p className="text-lg font-bold text-white">{data.totalEntries}</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gradient-to-br from-blue-500/15 via-blue-400/8 to-transparent border border-blue-400/30 rounded-xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Excellent Days</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {data.scores.filter(s => s.psychological_state === 'excellent').length}
                </p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent border border-blue-400/20 rounded-xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Moderate Days</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {data.scores.filter(s => s.psychological_state === 'moderate').length}
                </p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gradient-to-br from-slate-600/12 via-gray-600/8 to-zinc-600/5 border border-slate-500/30 rounded-xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/0 to-slate-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-slate-300" />
                  <p className="text-xs text-gray-400">Challenging Days</p>
                </div>
                <p className="text-2xl font-bold text-slate-300">
                  {data.scores.filter(s => s.psychological_state === 'challenging').length}
                </p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent border border-blue-400/20 rounded-xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Avg Mood</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {data.scores.filter(s => s.mood_rating).length > 0
                    ? Math.round(
                        data.scores
                          .filter(s => s.mood_rating)
                          .reduce((sum, s) => sum + (s.mood_rating || 0), 0) /
                          data.scores.filter(s => s.mood_rating).length
                      )
                    : '-'}
                  <span className="text-sm text-gray-400">/10</span>
                </p>
              </div>
            </motion.div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent border border-blue-400/30 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full blur-3xl" />
            <div className="relative">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-400" />
                Recent Scores
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.scores.slice(0, 10).map((score, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {new Date(score.date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {score.psychological_state && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          score.psychological_state === 'excellent'
                            ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                            : score.psychological_state === 'moderate'
                            ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                            : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                        }`}
                      >
                        {score.psychological_state}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${getScoreColor(score.score)}`}>
                    {score.score}
                  </span>
                </div>
              ))}
              </div>
            </div>
          </div>

          <motion.button
            /*
              No hover scale. This button is w-full, so growing it by even 1%
              makes it wider than its container - and an ancestor is
              overflow-y-auto, which forces overflow-x to auto as well, so the
              extra width was clipped and the button appeared sheared off on
              both edges mid-hover.

              Nothing is lost: the gradient brightens, the border lightens,
              the text lifts and a sheen sweeps across, which is already more
              hover feedback than most controls here get. whileTap stays
              because scaling DOWN cannot overflow anything.
            */
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate('/journal')}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500/10 via-blue-400/10 to-blue-500/10 hover:from-blue-500/20 hover:via-blue-400/20 hover:to-blue-500/20 border border-blue-400/30 hover:border-blue-400/50 text-blue-400 hover:text-blue-300 rounded-xl text-sm font-medium transition-all relative overflow-hidden group"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <span className="relative">View Journal Entries</span>
          </motion.button>
        </div>
        )}
      </div>
    </Card>
  );
}
