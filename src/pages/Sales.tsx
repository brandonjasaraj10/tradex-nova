import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Brain, Target, LineChart, Zap, AlertTriangle, ChevronRight, School as Psychology, TrendingUp, Eye, Clock, BarChart2, Sparkles, Calendar, BookOpen, ChevronLeft, Plus, Smile, Meh, Frown, DollarSign, Award, MessageSquare, Check } from 'lucide-react';
import Button from '../components/shared/Button';
import Footer from '../components/layout/Footer';
import SignupOrWaitlist from '../components/shared/SignupOrWaitlist';
import { useHasLaunched } from '../lib/launch';
import LaunchCountdown from '../components/shared/LaunchCountdown';
import { useState } from 'react';

const features = [
  {
    icon: BookOpen,
    title: 'Advanced Trading Journal',
    description: 'Track every trade with detailed insights, screenshots, and custom tags. Your complete trading history at your fingertips.',
    metrics: [
      { label: 'Data Points', value: '50+' },
      { label: 'Organization', value: '100%' }
    ]
  },
  {
    icon: Calendar,
    title: 'Visual Trade Calendar',
    description: 'See your trading activity and performance mapped across time. Identify your most profitable days and patterns.',
    metrics: [
      { label: 'View Options', value: '10+' },
      { label: 'Time Saved', value: '75%' }
    ]
  },
  {
    icon: Psychology,
    title: 'Trading Psychology Analysis',
    description: 'NOVA analyzes your trading patterns to identify emotional biases and psychological triggers that affect your performance.',
    metrics: [
      { label: 'Patterns', value: '45+' },
      { label: 'Accuracy', value: '94%' }
    ]
  },
  {
    icon: Eye,
    title: 'Pattern Recognition',
    description: 'Identify your most profitable setups and understand the market conditions where you perform best.',
    metrics: [
      { label: 'Success Rate', value: '87%' },
      { label: 'Data Points', value: '250K+' }
    ]
  },
  {
    icon: Target,
    title: 'Risk Profile Analysis',
    description: 'Understand your risk tolerance patterns and receive personalized position sizing recommendations.',
    metrics: [
      { label: 'Risk Control', value: '89%' },
      { label: 'Drawdown Cut', value: '45%' }
    ]
  },
  {
    icon: Brain,
    title: 'AI Trading Assistant',
    description: 'NOVA evolves with you, continuously learning from your trades to provide more personalized insights.',
    metrics: [
      { label: 'Learning Rate', value: '24hrs' },
      { label: 'Personal Fit', value: '96%' }
    ]
  }
];

const insights = [
  {
    type: 'psychology',
    title: 'Emotional Pattern Detected',
    description: 'You tend to overtrade after three consecutive winning trades, reducing your win rate by 35% in these scenarios.',
    recommendation: 'Take a 15-minute break after 3 consecutive wins to reset emotional state.',
    metrics: [
      { label: 'Pattern Confidence', value: '92%' },
      { label: 'Impact', value: '-35% WR' },
      { label: 'Occurrence', value: '24 times' }
    ],
    icon: Psychology,
    color: 'primary',
    badge: 'Critical Pattern'
  },
  {
    type: 'performance',
    title: 'Peak Performance Window',
    description: 'Your win rate increases by 45% when trading during the first 2 hours of market open with smaller position sizes.',
    recommendation: 'Focus 70% of your daily trades during this high-probability window.',
    metrics: [
      { label: 'Win Rate', value: '78%' },
      { label: 'Avg Return', value: '2.1R' },
      { label: 'Time Window', value: '9:30-11:30' }
    ],
    icon: Clock,
    color: 'primary',
    badge: 'Sweet Spot'
  },
  {
    type: 'risk',
    title: 'Risk Management Insight',
    description: 'Detected a pattern of increasing position sizes after winning trades, leading to larger drawdowns.',
    recommendation: 'Maintain consistent 1-2% risk per trade regardless of recent performance.',
    metrics: [
      { label: 'Risk Increase', value: '+85%' },
      { label: 'Drawdown', value: '+28%' },
      { label: 'Frequency', value: 'Weekly' }
    ],
    icon: AlertTriangle,
    color: 'primary',
    badge: 'Action Required'
  },
  {
    type: 'behavior',
    title: 'Trading Discipline Score',
    description: 'Your adherence to trading rules has improved by 68% over the past 30 days, correlating with better overall performance.',
    recommendation: 'Continue using pre-trade checklists to maintain this positive momentum.',
    metrics: [
      { label: 'Compliance', value: '85%' },
      { label: 'Improvement', value: '+68%' },
      { label: 'Rule Breaks', value: '3/month' }
    ],
    icon: Award,
    color: 'primary',
    badge: 'Trending Up'
  }
];

const proFeatures = [
  {
    category: 'Trading Journal',
    features: [
      'Unlimited Trade Logging',
      'Custom Tags & Categories',
      'Screenshot Attachments',
      'Multi-Timeframe Views'
    ]
  },
  {
    category: 'Performance Analytics',
    features: [
      'Advanced Metrics',
      'Visual Trade Calendar',
      'Risk Analysis',
      'Custom Reports'
    ]
  },
  {
    category: 'NOVA AI Assistant',
    features: [
      'Trading Psychology Analysis',
      'Pattern Recognition',
      'Personalized Insights',
      'Behavioral Coaching'
    ]
  }
];

export default function Sales() {
  const launched = useHasLaunched();
  const [showPsychologyCalendar, setShowPsychologyCalendar] = useState(false);
  const [journalView, setJournalView] = useState<'entry' | 'psychology'>('entry');
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-medium">TradeX</h1>
          </div>
        </div>
      </motion.div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14 sm:pt-16">
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{ y }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-gold-400/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gold-400/20 via-transparent to-transparent" />
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } }
            }}
          >
            <motion.div variants={fadeInUp} className="inline-block mb-4 sm:mb-6">
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gradient-to-r from-gold-400/20 to-gold-500/20 text-gold-400 border border-gold-400/30 backdrop-blur-sm">
                Introducing Tradex Nova
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white via-white/50 to-white bg-[length:200%_auto] animate-text-shimmer bg-clip-text text-transparent leading-normal px-2"
            >
              AI-Powered Trading Journal
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400 mb-6 sm:mb-8 max-w-3xl mx-auto px-4"
            >
              Track your trades, analyze your performance, and let NOVA help you develop a winning edge through advanced psychology insights.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex justify-center px-4">
              <div className="w-full max-w-md">
                <SignupOrWaitlist
                  placeholder="Enter your email to join waitlist"
                  preLaunchFootnote={
                    <>
                      <LaunchCountdown className="mt-6" />
                      <p className="mt-4 text-sm text-gray-400">
                        Join before launch to lock in{' '}
                        <span className="text-gray-500 line-through">$24.99</span>{' '}
                        <span className="text-blue-400 font-semibold">$14.99/mo</span>, forever.
                      </p>
                    </>
                  }
                  postLaunchFootnote={<LaunchCountdown className="mt-6" />}
                />
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="mt-10 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 lg:gap-8"
            >
              <div className="p-3 sm:p-4 md:p-5 rounded-xl bg-white/5 backdrop-blur-sm border border-gold-400/10">
                <div className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-gold-400 mb-1">50+</div>
                <div className="text-xs sm:text-sm text-gray-300">Data Points per Trade</div>
              </div>
              <div className="p-3 sm:p-4 md:p-5 rounded-xl bg-white/5 backdrop-blur-sm border border-gold-400/10">
                <div className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-gold-400 mb-1">45+</div>
                <div className="text-xs sm:text-sm text-gray-300">Psychology Patterns</div>
              </div>
              <div className="p-3 sm:p-4 md:p-5 rounded-xl bg-white/5 backdrop-blur-sm border border-gold-400/10">
                <div className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-gold-400 mb-1">Instant</div>
                <div className="text-xs sm:text-sm text-gray-300">AI Feedback</div>
              </div>
              <div className="p-3 sm:p-4 md:p-5 rounded-xl bg-white/5 backdrop-blur-sm border border-gold-400/10">
                <div className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-gold-400 mb-1">24/7</div>
                <div className="text-xs sm:text-sm text-gray-300">NOVA Support</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Dashboard Preview */}
      <div className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-black via-black/95 to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gold-400/10 via-transparent to-transparent opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-white leading-tight pb-2">Beautiful. Powerful. Intelligent.</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">Real-time analytics, visual calendars, and intelligent journaling.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Calendar Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl overflow-hidden bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] hover:border-white/10 transition-all duration-300 group sm:first:col-span-1"
            >
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      showPsychologyCalendar
                        ? 'bg-blue-500/20 shadow-lg shadow-blue-500/30'
                        : 'bg-blue-500/15 shadow-md shadow-blue-500/20'
                    }`}>
                      {showPsychologyCalendar ? <Brain className="w-5 h-5 text-blue-400" /> : <Calendar className="w-5 h-5 text-blue-400" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {showPsychologyCalendar ? 'Psychology Calendar' : 'Trading Calendar'}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {showPsychologyCalendar ? 'Track your mental state' : 'Visualize your performance'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => setShowPsychologyCalendar(!showPsychologyCalendar)}
                    className={`flex items-center bg-black/50 border rounded-lg p-1 transition-all ${
                      showPsychologyCalendar ? 'border-blue-500/30' : 'border-blue-500/30'
                    }`}
                    title={showPsychologyCalendar ? 'Show Trading Calendar' : 'Show Psychology Calendar'}
                  >
                    <div className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      !showPsychologyCalendar ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'
                    }`}>
                      P&L
                    </div>
                    <div className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      showPsychologyCalendar ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'
                    }`}>
                      Psych
                    </div>
                  </button>
                </div>

                <div className="space-y-4">
                  {!showPsychologyCalendar ? (
                    <>
                      {/* Trading Calendar Grid */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-300 font-medium">December 2024</span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm bg-blue-400/30 border border-blue-400/50"></div>
                              <span className="text-gray-500 text-[10px]">Win</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm bg-gray-500/30 border border-gray-500/50"></div>
                              <span className="text-gray-500 text-[10px]">Loss</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-[10px] text-gray-500 font-semibold py-1">
                              {day}
                            </div>
                          ))}

                          {/* Fake calendar data for December */}
                          {[
                            { day: 1, trades: 0, pnl: 0 },
                            { day: 2, trades: 3, pnl: 450 },
                            { day: 3, trades: 2, pnl: -180 },
                            { day: 4, trades: 4, pnl: 620 },
                            { day: 5, trades: 1, pnl: 210 },
                            { day: 6, trades: 0, pnl: 0 },
                            { day: 7, trades: 0, pnl: 0 },
                            { day: 8, trades: 0, pnl: 0 },
                            { day: 9, trades: 2, pnl: 380 },
                            { day: 10, trades: 5, pnl: -290 },
                            { day: 11, trades: 3, pnl: 540 },
                            { day: 12, trades: 2, pnl: 195 },
                            { day: 13, trades: 1, pnl: -85 },
                            { day: 14, trades: 0, pnl: 0 },
                            { day: 15, trades: 0, pnl: 0 },
                            { day: 16, trades: 4, pnl: 725 },
                            { day: 17, trades: 2, pnl: 340 },
                            { day: 18, trades: 3, pnl: -215 },
                            { day: 19, trades: 6, pnl: 890 },
                            { day: 20, trades: 2, pnl: 175 },
                            { day: 21, trades: 0, pnl: 0 },
                            { day: 22, trades: 0, pnl: 0 },
                            { day: 23, trades: 3, pnl: 450 },
                            { day: 24, trades: 1, pnl: -120 },
                            { day: 25, trades: 0, pnl: 0 },
                            { day: 26, trades: 2, pnl: 310 },
                            { day: 27, trades: 4, pnl: 580 },
                            { day: 28, trades: 0, pnl: 0 },
                            { day: 29, trades: 0, pnl: 0 },
                            { day: 30, trades: 3, pnl: -165 },
                            { day: 31, trades: 2, pnl: 420 },
                          ].map((data, i) => {
                            const hasTrades = data.trades > 0;
                            const isWin = data.pnl > 0;
                            const intensity = hasTrades
                              ? Math.min(Math.abs(data.pnl) / 300, 1)
                              : 0;

                            return (
                              <div
                                key={i}
                                className={`
                                  aspect-square border rounded-md transition-all duration-300 cursor-pointer
                                  flex flex-col items-center justify-between p-1 relative group/day
                                  ${!hasTrades ? 'bg-white/[0.03] border-white/10 text-gray-600' : ''}
                                  ${hasTrades && isWin ? 'bg-blue-400/10 border-blue-400/20 text-blue-400 hover:scale-105 hover:border-blue-400/40 hover:shadow-lg hover:shadow-blue-500/20' : ''}
                                  ${hasTrades && !isWin ? 'bg-gray-500/10 border-gray-500/30 text-gray-400 hover:scale-105 hover:border-gray-500/50' : ''}
                                `}
                              >
                                <span className="text-[10px] font-semibold">{data.day}</span>
                                {hasTrades && (
                                  <div className="text-center">
                                    <div className="text-[9px]">{data.trades}t</div>
                                    <div className="text-[9px] font-bold">${Math.abs(data.pnl)}</div>
                                  </div>
                                )}
                                {hasTrades && (
                                  <div className="absolute inset-0 opacity-0 group-hover/day:opacity-100 transition-opacity bg-black/90 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/20">
                                    <div className="text-center px-1">
                                      <div className={`font-bold text-sm ${isWin ? 'text-blue-400' : 'text-gray-400'}`}>
                                        {isWin ? '+' : ''}${data.pnl}
                                      </div>
                                      <div className="text-gray-500 text-[10px]">{data.trades} trades</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/[0.05]">
                        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-blue-400">72%</div>
                          <div className="text-[10px] text-gray-500">Win Rate</div>
                        </div>
                        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-white">48</div>
                          <div className="text-[10px] text-gray-500">Trades</div>
                        </div>
                        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-blue-400">+$5.2K</div>
                          <div className="text-[10px] text-gray-500">Total P&L</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Psychology Calendar Grid */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-300 font-medium">December 2024</span>
                          <div className="text-[10px] text-gray-500">NOVA Scores</div>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-[10px] text-gray-500 font-semibold py-1">
                              {day}
                            </div>
                          ))}

                          {/* Fake psychology data */}
                          {[
                            { day: 1, mood: null, score: 0 },
                            { day: 2, mood: 'good', score: 85 },
                            { day: 3, mood: 'neutral', score: 65 },
                            { day: 4, mood: 'good', score: 90 },
                            { day: 5, mood: 'good', score: 80 },
                            { day: 6, mood: null, score: 0 },
                            { day: 7, mood: null, score: 0 },
                            { day: 8, mood: null, score: 0 },
                            { day: 9, mood: 'good', score: 88 },
                            { day: 10, mood: 'poor', score: 35 },
                            { day: 11, mood: 'good', score: 92 },
                            { day: 12, mood: 'neutral', score: 70 },
                            { day: 13, mood: 'neutral', score: 58 },
                            { day: 14, mood: null, score: 0 },
                            { day: 15, mood: null, score: 0 },
                            { day: 16, mood: 'good', score: 95 },
                            { day: 17, mood: 'good', score: 83 },
                            { day: 18, mood: 'neutral', score: 52 },
                            { day: 19, mood: 'good', score: 98 },
                            { day: 20, mood: 'good', score: 87 },
                            { day: 21, mood: null, score: 0 },
                            { day: 22, mood: null, score: 0 },
                            { day: 23, mood: 'good', score: 85 },
                            { day: 24, mood: 'poor', score: 40 },
                            { day: 25, mood: null, score: 0 },
                            { day: 26, mood: 'neutral', score: 72 },
                            { day: 27, mood: 'good', score: 89 },
                            { day: 28, mood: null, score: 0 },
                            { day: 29, mood: null, score: 0 },
                            { day: 30, mood: 'neutral', score: 55 },
                            { day: 31, mood: 'good', score: 86 },
                          ].map((data, i) => {
                            const hasMood = data.mood !== null;
                            let cellClasses = 'bg-white/[0.03] border-white/10 text-gray-600';
                            let textColor = 'text-gray-400';

                            if (hasMood) {
                              if (data.score >= 90) {
                                cellClasses = 'bg-gradient-to-br from-blue-500/40 via-blue-500/30 to-blue-600/25 border-blue-400/60 shadow-lg shadow-blue-500/20';
                                textColor = 'text-blue-400';
                              } else if (data.score >= 80) {
                                cellClasses = 'bg-gradient-to-br from-blue-400/35 via-blue-400/25 to-blue-500/20 border-blue-400/50 shadow-md shadow-blue-500/15';
                                textColor = 'text-blue-400';
                              } else if (data.score >= 70) {
                                cellClasses = 'bg-gradient-to-br from-blue-500/30 via-blue-500/20 to-blue-500/15 border-blue-400/40 shadow-md shadow-blue-500/10';
                                textColor = 'text-blue-400';
                              } else if (data.score >= 60) {
                                cellClasses = 'bg-gradient-to-br from-blue-400/25 via-blue-400/15 to-blue-400/10 border-blue-400/35';
                                textColor = 'text-blue-400';
                              } else if (data.score >= 50) {
                                cellClasses = 'bg-gradient-to-br from-blue-400/20 via-blue-400/10 to-slate-400/10 border-blue-400/30';
                                textColor = 'text-blue-400';
                              } else if (data.score >= 40) {
                                cellClasses = 'bg-gradient-to-br from-slate-400/20 via-gray-500/15 to-zinc-500/10 border-slate-400/30';
                                textColor = 'text-slate-300';
                              } else {
                                cellClasses = 'bg-gradient-to-br from-blue-500/25 via-blue-600/15 to-blue-600/10 border-blue-500/40 shadow-sm shadow-blue-500/10';
                                textColor = 'text-blue-400';
                              }
                            }

                            return (
                              <div
                                key={i}
                                className={`
                                  aspect-square border rounded-md transition-all duration-300 cursor-pointer
                                  flex flex-col items-center justify-between p-1 relative group/day
                                  ${cellClasses} ${hasMood ? 'hover:scale-105' : ''}
                                `}
                              >
                                <span className={`text-[10px] font-semibold ${hasMood ? textColor : 'text-gray-600'}`}>{data.day}</span>
                                {hasMood && (
                                  <div className="text-center relative">
                                    <div className={`text-xs font-bold ${textColor}`}>
                                      {data.score}
                                    </div>
                                    <div className="text-[8px] text-gray-400">NOVA</div>
                                  </div>
                                )}
                                {hasMood && (
                                  <div className="absolute inset-0 opacity-0 group-hover/day:opacity-100 transition-opacity bg-black/90 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/20">
                                    <div className="text-center">
                                      <div className={`text-2xl font-bold ${textColor}`}>{data.score}</div>
                                      <div className="text-gray-400 text-[10px] mt-0.5">NOVA Score</div>
                                      <div className={`text-[9px] font-medium mt-1 ${textColor}`}>
                                        {data.score >= 80 ? 'Peak State' : data.score >= 70 ? 'Strong Mind' : data.score >= 60 ? 'Solid' : data.score >= 50 ? 'Balanced' : 'Challenged'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Psychology Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/[0.05]">
                        <div className="bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-transparent border border-blue-500/30 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-blue-400">81</div>
                          <div className="text-[10px] text-gray-500">Avg Score</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-transparent border border-blue-500/30 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-blue-400">75%</div>
                          <div className="text-[10px] text-gray-500">Peak Days</div>
                        </div>
                        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                          <div className="text-base font-bold text-white">20</div>
                          <div className="text-[10px] text-gray-500">Entries</div>
                        </div>
                      </div>

                      {/* Mental State Spectrum */}
                      <div className="mt-4 pt-3 border-t border-white/[0.05]">
                        <div className="text-[10px] text-gray-500 mb-2 font-semibold">Mental State Spectrum</div>
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-sm bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-500/50"></div>
                            <span className="text-[9px] text-blue-400">Low</span>
                          </div>
                          <div className="w-1 h-[2px] bg-gradient-to-r from-blue-500/30 to-blue-500/30"></div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-sm bg-gradient-to-br from-slate-400/20 to-gray-500/10 border border-slate-400/30"></div>
                            <span className="text-[9px] text-slate-300">Mid</span>
                          </div>
                          <div className="w-1 h-[2px] bg-gradient-to-r from-slate-500/30 to-blue-500/30"></div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-sm bg-gradient-to-br from-blue-500/30 to-blue-500/20 border border-blue-400/40 shadow-sm"></div>
                            <span className="text-[9px] text-blue-400">High</span>
                          </div>
                          <div className="w-1 h-[2px] bg-gradient-to-r from-blue-500/30 to-blue-500/30"></div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-sm bg-gradient-to-br from-blue-500/40 to-blue-500/30 border border-blue-400/60 shadow-md"></div>
                            <span className="text-[9px] text-blue-400">Peak</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Analytics Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative rounded-2xl overflow-hidden bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] hover:border-white/10 transition-all duration-300 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/30 flex items-center justify-center border border-blue-500/20 group-hover:shadow-blue-500/50 transition-all">
                    <BarChart2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">Performance Analytics</h3>
                    <p className="text-xs text-gray-400">Track your progress</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Dual Equity Curves */}
                  <div className="relative h-36 rounded-xl bg-gradient-to-br from-black/40 via-black/30 to-blue-500/5 p-4 border border-white/[0.08] overflow-hidden group/chart">
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity"></div>

                    <div className="flex items-start justify-between mb-2 relative z-10">
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-1">30-Day Performance</div>
                        <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 rounded-lg px-2 py-0.5 backdrop-blur-sm w-fit">
                          <TrendingUp className="w-3 h-3 text-blue-400" />
                          <span className="text-xs font-bold text-blue-400">+42.8%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                          <span className="text-[10px] text-blue-400">Equity</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                          <span className="text-[10px] text-gray-400">Balance</span>
                        </div>
                      </div>
                    </div>

                    <svg className="w-full h-full relative z-10" viewBox="0 0 300 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgb(96, 165, 250)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="rgb(96, 165, 250)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgb(156, 163, 175)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="rgb(156, 163, 175)" stopOpacity="0" />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Balance curve */}
                      <path
                        d="M0,85 L25,82 L50,75 L75,78 L100,70 L125,72 L150,65 L175,68 L200,60 L225,58 L250,52 L275,48 L295,45"
                        fill="none"
                        stroke="rgb(156, 163, 175)"
                        strokeWidth="2"
                        opacity="0.6"
                      />
                      <path
                        d="M0,85 L25,82 L50,75 L75,78 L100,70 L125,72 L150,65 L175,68 L200,60 L225,58 L250,52 L275,48 L295,45 L295,100 L0,100 Z"
                        fill="url(#balanceGradient)"
                      />

                      {/* Equity curve */}
                      <path
                        d="M0,80 L25,76 L50,68 L75,70 L100,58 L125,62 L150,50 L175,54 L200,42 L225,38 L250,30 L275,25 L295,20"
                        fill="none"
                        stroke="rgb(96, 165, 250)"
                        strokeWidth="2.5"
                        filter="url(#glow)"
                      />
                      <path
                        d="M0,80 L25,76 L50,68 L75,70 L100,58 L125,62 L150,50 L175,54 L200,42 L225,38 L250,30 L275,25 L295,20 L295,100 L0,100 Z"
                        fill="url(#equityGradient)"
                      />

                      {/* Current position indicator */}
                      <circle cx="295" cy="20" r="3" fill="rgb(96, 165, 250)" className="animate-pulse">
                        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                  </div>

                  {/* Enhanced Key Metrics */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 overflow-hidden group/metric hover:border-blue-500/40 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover/metric:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-gray-500 font-medium">Total P&L</div>
                          <TrendingUp className="w-3 h-3 text-blue-400 opacity-50" />
                        </div>
                        <div className="text-lg font-bold text-blue-400 tracking-tight">$8,432</div>
                        <div className="text-[9px] text-blue-400/60 mt-0.5">+$1,240 this week</div>
                      </div>
                    </div>

                    <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 overflow-hidden group/metric hover:border-blue-500/40 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover/metric:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-gray-500 font-medium">Win Rate</div>
                          <Target className="w-3 h-3 text-blue-400 opacity-50" />
                        </div>
                        <div className="text-lg font-bold text-blue-400 tracking-tight">68.5%</div>
                        <div className="text-[9px] text-blue-400/60 mt-0.5">37 wins / 54 trades</div>
                      </div>
                    </div>

                    <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 overflow-hidden group/metric hover:border-blue-500/40 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover/metric:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-gray-500 font-medium">Avg Win</div>
                          <DollarSign className="w-3 h-3 text-blue-400 opacity-50" />
                        </div>
                        <div className="text-lg font-bold text-blue-400 tracking-tight">$284</div>
                        <div className="text-[9px] text-blue-400/60 mt-0.5">Avg loss: $118</div>
                      </div>
                    </div>

                    <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 overflow-hidden group/metric hover:border-blue-500/40 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/10 opacity-0 group-hover/metric:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-gray-500 font-medium">Profit Factor</div>
                          <Award className="w-3 h-3 text-blue-400 opacity-50" />
                        </div>
                        <div className="text-lg font-bold text-blue-400 tracking-tight">2.4</div>
                        <div className="text-[9px] text-blue-400/60 mt-0.5">Excellent ratio</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Journal Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative rounded-2xl overflow-hidden bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] hover:border-white/10 transition-all duration-300 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 shadow-md shadow-blue-500/20 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">Trading Journal</h3>
                      <p className="text-xs text-gray-400">Document every detail</p>
                    </div>
                  </div>

                  {/* Toggle Buttons */}
                  <div className="flex gap-2 bg-black/40 rounded-lg p-1 border border-white/[0.05]">
                    <button
                      onClick={() => setJournalView('entry')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        journalView === 'entry'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Entry
                    </button>
                    <button
                      onClick={() => setJournalView('psychology')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        journalView === 'psychology'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Psychology
                    </button>
                  </div>
                </div>

                {journalView === 'entry' ? (
                  <div className="space-y-3">
                    {/* Journal Entry Preview */}
                    <div className="p-4 rounded-lg bg-black/30 border border-white/[0.05]">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded bg-blue-400/20 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">EURUSD</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">LONG</span>
                          </div>
                          <div className="text-xs text-gray-400 mb-2">Setup: Bull Flag Breakout on H4</div>

                          {/* Entry Details */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="text-xs">
                              <span className="text-gray-500">Entry: </span>
                              <span className="text-white">1.0850</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-gray-500">Exit: </span>
                              <span className="text-white">1.0920</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-gray-500">SL: </span>
                              <span className="text-white">1.0820</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-gray-500">TP: </span>
                              <span className="text-white">1.0940</span>
                            </div>
                          </div>

                          {/* Notes Preview */}
                          <div className="text-xs text-gray-400 bg-black/30 rounded p-2 mb-2">
                            Strong bullish momentum after ECB rate decision. Price broke above key resistance with increased volume...
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-blue-400">+$1,250</div>
                          <div className="text-xs text-gray-500">+4.2%</div>
                        </div>
                      </div>

                      {/* Confluences */}
                      <div className="flex gap-2 flex-wrap mb-3">
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Trend</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Volume</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Key Level</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">News</span>
                      </div>

                      {/* Screenshots */}
                      <div className="flex gap-2">
                        <div className="flex-1 h-16 rounded bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                          <span className="text-xs text-blue-400">Entry Chart</span>
                        </div>
                        <div className="flex-1 h-16 rounded bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                          <span className="text-xs text-blue-400">Exit Chart</span>
                        </div>
                      </div>
                    </div>

                    {/* NOVA Insight */}
                    <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-medium text-blue-400 mb-1">NOVA Insight</div>
                          <div className="text-xs text-gray-400">Your patience during consolidation led to excellent entry timing. All confluences aligned before entry.</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="bg-black/30 border border-white/[0.05] rounded-lg p-2 text-center">
                        <div className="text-sm font-bold text-blue-400">85</div>
                        <div className="text-[10px] text-gray-500">NOVA Score</div>
                      </div>
                      <div className="bg-black/30 border border-white/[0.05] rounded-lg p-2 text-center">
                        <div className="text-sm font-bold text-blue-400">2.8R</div>
                        <div className="text-[10px] text-gray-500">Risk/Reward</div>
                      </div>
                      <div className="bg-black/30 border border-white/[0.05] rounded-lg p-2 text-center">
                        <div className="text-sm font-bold text-white">4/5</div>
                        <div className="text-[10px] text-gray-500">Confluences</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Psychology Template Preview */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded bg-blue-400/20 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Pre-Trade Psychology</div>
                          <div className="text-xs text-gray-500">Mental preparation checklist</div>
                        </div>
                        <div className="px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                          <span className="text-xs font-medium text-blue-400">92%</span>
                        </div>
                      </div>

                      {/* Mental State Indicators */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Emotional State</span>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Focus Level</span>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Confidence</span>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                          </div>
                        </div>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-2 bg-black/30 rounded p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-blue-400" />
                          </div>
                          <span className="text-xs text-gray-300">Reviewed trading plan</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-blue-400" />
                          </div>
                          <span className="text-xs text-gray-300">Risk management in place</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-blue-400" />
                          </div>
                          <span className="text-xs text-gray-300">Clear exit strategy defined</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-blue-500/50 flex-shrink-0"></div>
                          <span className="text-xs text-gray-400">Checked market conditions</span>
                        </div>
                      </div>
                    </div>

                    {/* Post-Trade Reflection */}
                    <div className="p-4 rounded-lg bg-black/30 border border-white/[0.05]">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-medium text-gray-300">Post-Trade Reflection</span>
                      </div>
                      <div className="text-xs text-gray-400 bg-black/30 rounded p-2 mb-2">
                        Stayed disciplined and followed my plan. Resisted the urge to move stop-loss when price dipped briefly. Emotional control was key to this win.
                      </div>

                      {/* Lessons Learned */}
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Patience</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Discipline</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Trust Process</span>
                      </div>
                    </div>

                    {/* NOVA Psychology Score */}
                    <div className="relative p-4 rounded-lg bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/10 border border-blue-500/30 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 via-blue-400/5 to-blue-400/5 animate-pulse"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-400">NOVA Psychology Score</div>
                              <div className="text-sm font-bold bg-gradient-to-r from-blue-400 via-blue-400 to-blue-400 bg-clip-text text-transparent">Excellent Performance</div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">92</div>
                        </div>

                        {/* Score Bar */}
                        <div className="relative h-2 bg-black/30 rounded-full overflow-hidden mb-2">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-500 to-blue-500 rounded-full" style={{ width: '92%' }}></div>
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/50 via-blue-400/50 to-blue-400/50 rounded-full animate-pulse" style={{ width: '92%' }}></div>
                        </div>

                        <div className="text-xs text-gray-400">Your mental preparation and post-trade analysis show strong psychological discipline.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Live Insights Section */}
      <div className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-black via-black/95 to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gold-400/5 via-transparent to-transparent" />

        {/* Animated floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-gold-400/20 rounded-full animate-pulse"
               style={{ animation: 'float 8s ease-in-out infinite' }} />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-blue-400/20 rounded-full animate-pulse"
               style={{ animation: 'float 6s ease-in-out infinite 1s' }} />
          <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-blue-400/20 rounded-full animate-pulse"
               style={{ animation: 'float 7s ease-in-out infinite 2s' }} />
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-blue-400/20 rounded-full animate-pulse"
               style={{ animation: 'float 9s ease-in-out infinite 0.5s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 sm:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-gold-400/10 to-gold-500/10 border border-gold-400/20 mb-3 sm:mb-4"
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-gold-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-medium text-gold-400">Powered by Advanced AI</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-white px-4"
            >
              Meet NOVA: Your AI Trading Coach
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto px-4"
            >
              NOVA provides real-time psychology analysis, pattern recognition, and personalized insights to help you master your trading psychology and maximize performance.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-12">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer"
              >
                <div className={`
                  relative overflow-hidden rounded-2xl backdrop-blur-sm
                  border hover:shadow-2xl
                  transition-all duration-500 ease-in-out
                  bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] h-full
                  border-blue-400/20 hover:border-blue-400/60 hover:shadow-blue-400/30
                `}>
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10">
                    <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent animate-pulse" />
                  </div>

                  {/* Subtle shimmer effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent bg-[length:200%_100%] animate-text-shimmer" />
                  </div>

                  <div className="relative p-4 sm:p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-start gap-3 sm:gap-4 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 bg-blue-400/20 text-blue-400 shadow-lg shadow-blue-400/30 group-hover:shadow-blue-400/60 group-hover:bg-blue-400/30">
                          <insight.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>

                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-semibold mb-1 transition-all duration-300 text-blue-400 group-hover:text-blue-300">
                            {insight.title}
                          </h3>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300 bg-blue-400/10 text-blue-400 border border-blue-400/20 group-hover:bg-blue-400/20 group-hover:border-blue-400/40">
                            {insight.badge}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4 leading-relaxed">
                      {insight.description}
                    </p>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {insight.metrics.map((metric, i) => (
                        <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
                          <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
                          <p className="text-sm font-bold text-white">{metric.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recommendation */}
                    <div className="p-3 rounded-lg border transition-all duration-300 bg-blue-400/5 border-blue-400/20 group-hover:bg-blue-400/10 group-hover:border-blue-400/30">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse text-blue-400" />
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">NOVA Recommendation</p>
                          <p className="text-xs text-gray-300">{insight.recommendation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Hover Action */}
                    <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-sm text-gold-400">
                        <span>View Detailed Analysis</span>
                        <ChevronRight size={16} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Updated 5m ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* NOVA Chat Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-blue-400/20 hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-400/20 transition-all duration-500 group/nova p-8"
          >
            {/* Animated background layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 opacity-0 group-hover/nova:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent opacity-50 animate-pulse" />
            </div>

            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-0 group-hover/nova:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent bg-[length:200%_100%] animate-text-shimmer" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-400/30 group-hover/nova:shadow-blue-400/60 group-hover/nova:scale-110 transition-all duration-500">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-blue-400 group-hover/nova:text-blue-300 transition-colors duration-300">Chat with NOVA</h3>
                  <p className="text-xs sm:text-sm text-white/80">Ask questions about your trading psychology and get instant insights</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[
                  { question: "Why do I keep moving my stop loss?", insight: "Analysis shows 78% of moved stops lead to bigger losses", color: 'blue' },
                  { question: "When am I most profitable?", insight: "Your win rate is 45% higher during morning sessions", color: 'blue' },
                  { question: "How can I improve my discipline?", insight: "Try pre-trade checklists - they improved compliance by 68%", color: 'blue' }
                ].map((item, i) => (
                  <div
                    key={i}
                    className="relative rounded-lg p-4 border overflow-hidden transition-all duration-500 group/chat cursor-pointer transform hover:scale-105 bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-400/30 hover:border-blue-400/60 hover:shadow-xl hover:shadow-blue-400/30"
                  >
                    {/* Animated gradient background on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover/chat:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-400/20 via-blue-400/10 to-blue-500/20" />

                    {/* Shimmer effect */}
                    <div className="absolute inset-0 opacity-0 group-hover/chat:opacity-100 transition-opacity duration-700">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300/20 to-transparent bg-[length:200%_100%] animate-text-shimmer" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-start gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-400/40 group-hover/chat:shadow-blue-400/60 group-hover/chat:scale-110">
                          <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm font-semibold flex-1 transition-colors duration-300 text-blue-100 group-hover/chat:text-blue-50">{item.question}</p>
                      </div>

                      <div className="bg-black/30 rounded-md p-3 mb-2 border transition-all duration-300 border-blue-400/20 group-hover/chat:border-blue-400/40 group-hover/chat:bg-black/40">
                        <p className="text-xs font-medium transition-colors duration-300 text-blue-200 group-hover/chat:text-blue-100">{item.insight}</p>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-semibold opacity-0 group-hover/chat:opacity-100 transition-all duration-300 text-blue-300">
                        <Sparkles className="w-3 h-3" />
                        <span>Ask NOVA this question</span>
                        <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-black via-black/95 to-black relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-400/3 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16 lg:mb-20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-4 sm:mb-6"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gold-400/10 border border-gold-400/20 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-gold-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-gold-400">Complete Trading Suite</span>
              </div>
            </motion.div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-white leading-tight pb-2 px-4">
              Everything You Need
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto px-4">Advanced journaling, visual analytics, AI insights, and comprehensive trade tracking.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30, rotateX: 10 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="relative group"
              >
                {/* Glow Effect on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-400/0 to-gold-400/0 group-hover:from-gold-400/10 group-hover:to-transparent rounded-2xl blur-xl transition-all duration-500 -z-10"></div>

                {/* Card */}
                <div className="relative h-full p-8 rounded-2xl bg-gradient-to-br from-white/[0.07] via-white/[0.05] to-transparent border border-white/10 group-hover:border-gold-400/40 transition-all duration-300 overflow-hidden backdrop-blur-sm">
                  {/* Animated Border Gradient */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-[-2px] bg-gradient-to-r from-gold-400/20 via-gold-300/10 to-gold-400/20 rounded-2xl blur-sm"></div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon */}
                    <motion.div
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-400/5 flex items-center justify-center mb-6 border border-gold-400/20 shadow-lg shadow-gold-400/10 group-hover:shadow-gold-400/30 group-hover:scale-110 transition-all duration-300"
                      whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
                    >
                      <feature.icon className="w-7 h-7 text-gold-400 group-hover:scale-110 transition-transform" />
                    </motion.div>

                    {/* Title and Description */}
                    <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gold-400/90 transition-colors">{feature.title}</h3>
                    <p className="text-gray-400 mb-6 leading-relaxed">{feature.description}</p>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      {feature.metrics.map((metric, i) => (
                        <motion.div
                          key={i}
                          className="relative bg-gradient-to-br from-black/40 to-black/20 rounded-xl p-4 border border-white/[0.08] group-hover:border-gold-400/20 transition-all overflow-hidden"
                          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                        >
                          {/* Shimmer Effect */}
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

                          <div className="relative z-10">
                            <div className="text-xs text-gray-500 mb-1 font-medium">{metric.label}</div>
                            <div className="text-lg font-bold text-gold-400">{metric.value}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Founder Video Section */}
      <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8 sm:mb-10">
              <div className="inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-[0.2em] bg-blue-500/10 text-blue-400 border border-blue-400/30 mb-4">
                FROM THE FOUNDER
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 px-4">
                Why I built TradeX
              </h2>
              <p className="text-base sm:text-lg text-gray-400 px-4 max-w-2xl mx-auto">
                A quick word on what this is, who it's for, and where it's going.
              </p>
            </div>

            {/*
              preload="metadata" so visitors only download the ~12MB video if
              they actually press play - otherwise landing on the page would
              pull it down for everyone. playsInline keeps iOS from hijacking
              it into fullscreen. No autoplay: it has voice audio, and
              browsers block autoplay-with-sound anyway.
            */}
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl shadow-blue-500/10">
              <video
                className="w-full aspect-video bg-black"
                controls
                preload="metadata"
                playsInline
                poster="/founder-video-poster.jpg"
              >
                <source src="/founder-video.mp4" type="video/mp4" />
                Your browser doesn't support embedded video. You can still join the
                waitlist below.
              </video>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-400/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 px-4">Simple, Transparent Pricing</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">Join the waitlist before launch and lock in founding member pricing.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="p-6 md:p-8 lg:p-10 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-gold-400/50 transition-all">
              {/*
                The public price has to change at launch. $14.99 is founder
                pricing - only for people already on the waitlist, and only
                until Tuesday - so advertising it to every visitor after
                launch promises a price checkout will not honour, and they
                would discover that at the card form. Founders still see
                their real price on the paywall, where eligibility is known.
              */}
              <div className="text-center mb-10 md:mb-12">
                <div className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 mb-4">
                  {launched ? 'TradeX Pro' : 'Founding Member Pricing'}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-2">TradeX Pro</h3>
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  {!launched && (
                    <span className="text-2xl md:text-3xl text-gray-500 line-through mr-3">$24.99</span>
                  )}
                  <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                    {launched ? '$24.99' : '$14.99'}
                  </span>
                  <span className="text-lg md:text-xl font-normal text-gray-400">/month</span>
                </div>
                <p className="text-sm md:text-base text-gray-400">
                  {launched
                    ? '7-day free trial • Cancel anytime'
                    : 'Locked in forever • 7-day free trial • Cancel anytime'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-10 md:mb-12">
                {proFeatures.map((category, index) => (
                  <div key={index}>
                    <h4 className="text-gold-400 font-medium mb-4">{category.category}</h4>
                    <ul className="space-y-3">
                      {category.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <SignupOrWaitlist
                preLaunchFootnote={
                  <p className="text-center text-sm text-gray-400 mt-4">
                    Join now to lock in $14.99/mo — this price ends at launch
                  </p>
                }
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 px-4">Common Questions</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">Everything you need to know</p>
          </div>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
            >
              <h3 className="text-lg font-medium mb-2">What makes TradeX different from other trading journals?</h3>
              <p className="text-sm text-gray-400">
                Unlike traditional trading journals, TradeX combines advanced journaling capabilities with NOVA, our AI trading assistant. NOVA analyzes your trading patterns, psychology, and behavior to provide personalized insights that help you develop a winning edge.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
            >
              <h3 className="text-lg font-medium mb-2">How does NOVA AI help improve my trading?</h3>
              <p className="text-sm text-gray-400">
                NOVA analyzes your trading data to identify patterns in your behavior, psychology, and market conditions. It helps you understand when you're most profitable, detects emotional trading patterns, and provides actionable insights to improve your strategy.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
            >
              <h3 className="text-lg font-medium mb-2">Can I import my trades automatically?</h3>
              <p className="text-sm text-gray-400">
                Currently, trades can be manually entered directly into the platform. We're working on AutoSync, an automatic trade importing feature that will connect with major brokers. This exciting update is coming soon!
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
            >
              <h3 className="text-lg font-medium mb-2">Is my trading data secure?</h3>
              <p className="text-sm text-gray-400">
                Absolutely. We use bank-level encryption to protect your data, and we never share your information with third parties. Your trading data is stored securely and is only used to provide you with insights and analysis through NOVA.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
            >
              <h3 className="text-lg font-medium mb-2">What markets does TradeX support?</h3>
              <p className="text-sm text-gray-400">
                TradeX supports all major markets including stocks, options, futures, forex, and crypto. You can track trades across multiple markets and accounts in one place, with specialized analysis for each market type.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-white px-4">Trusted by Early Users</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">Real results from traders using TradeX</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 md:p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-white font-medium">MS</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Michael S.</h3>
                  <p className="text-sm text-gray-400">Forex Trader</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">
                "NOVA's psychological insights helped me identify and fix my emotional trading patterns. My win rate improved by 35% in just two months."
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 md:p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-white font-medium">SL</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Sarah L.</h3>
                  <p className="text-sm text-gray-400">Options Trader</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">
                "The visual trade calendar and analytics helped me identify my most profitable setups. TradeX has completely transformed my trading approach."
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 md:p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-white font-medium">DR</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">David R.</h3>
                  <p className="text-sm text-gray-400">Crypto Trader</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">
                "The detailed analytics and journaling features save me hours each week. NOVA's insights have helped me become more consistent and disciplined."
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-white px-4 leading-tight">
              Ready to Transform Your Trading?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
              Join traders who have transformed their results with AI-powered insights from NOVA.
            </p>
              <div className="max-w-md mx-auto px-4">
                <SignupOrWaitlist
                  preLaunchFootnote={
                    <p className="text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
                      Join before launch to lock in{' '}
                      <span className="line-through">$24.99</span>{' '}
                      <span className="text-blue-400 font-semibold">$14.99/mo</span>, forever.
                    </p>
                  }
                />
              </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}