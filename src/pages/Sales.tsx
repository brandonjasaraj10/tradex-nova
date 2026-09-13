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
          {/*
            The way back in for people who already have an account.

            Every call to action on this page said "Start My Free Trial" and
            pointed at /auth?mode=signup. A returning subscriber had to click
            the button offering a free trial they are already past, then find
            "Already have an account? Sign in" at the foot of the signup form.
            It worked, but nobody's first instinct is to start a trial in order
            to reach an account they already pay for - and the header's
            right-hand side, where everyone looks, was empty.
          */}
          <Link
            to="/auth?mode=signin"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </motion.div>

      {/*
        Hero.

        Monochrome - black, white and grey. The blue is held back for the
        product panel below, where it means something.

        Centred in the first screen rather than stacked from the top: the
        block is vertically centred in the viewport minus the header, so a
        phone opens on a composed screen instead of content pinned to the top
        edge with dead space beneath it. min-h is calc-based, not 100vh, so it
        can grow past the fold on a small phone rather than clipping.
      */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/*
            A faint grid, faded at the edges, so the black has texture rather
            than reading as an empty void. 48px cells at 3.5% white.
          */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%)',
            }}
          />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[820px] h-[520px] rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-5 sm:px-8 pt-14 sm:pt-16
          min-h-[calc(88svh-3.5rem)] sm:min-h-[calc(84svh-4rem)]
          flex flex-col justify-center text-center pb-6 pt-10">

          <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
            Trading journal &middot; Built around psychology
          </p>

          {/*
            Solid white. The white-to-grey fade made the second line look like
            it was dimming out rather than being emphasised - the headline is
            the offer and it should not fade.
          */}
          <h1 className="text-[46px] leading-[1.02] sm:text-6xl lg:text-[80px] lg:leading-[0.98]
            font-semibold tracking-[-0.04em] text-white text-balance">
            Stop guessing<br className="sm:hidden" /> why you lose
          </h1>

          <p className="mt-4 text-[14.5px] sm:text-base leading-snug text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
            Talk through the trade. TradeX writes the entry and finds the pattern
            costing you money.
          </p>

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <Link
              to="/auth?mode=signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium
                hover:bg-gray-200 transition-colors"
            >
              Start journaling
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11.5px] text-gray-500">
              14-day money back guarantee &middot; Cancel anytime
            </p>
          </div>

          {/*
            The work they do not have to do. Every journal promises insight;
            what stops people is the effort, so these name the effort removed.
          */}
          <ul className="mt-5 flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5">
            {[
              /*
                Objection-killers, not features. Each answers a reason a
                trader does not buy a journal: it is too much work, I already
                have a spreadsheet, I do not want you near my account.

                "Journal by voice" rather than "No typing" - you can still
                type, so the restriction framing was simply wrong. "Never
                touches your money" is active and stays true whether or not
                broker sync is switched on, because read-only is the only
                access TradeX ever asks for.
              */
              'Journal by voice',
              'No spreadsheets',
              'Never touches your money',
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[11.5px] text-gray-400">
                <Check className="w-3 h-3 flex-shrink-0 text-gray-500" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>

          {/*
            Social proof, sized to what is actually true.

            Competitors put customer logos and five-figure counts here. We have
            310 signups, so that is what it says. The circles carry initials
            rather than faces - inventing photographs of customers who have not
            agreed to appear would be the one thing on this page that could not
            be defended.
          */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              {['M', 'J', 'K', 'A', 'R'].map((initial, i) => (
                <span
                  key={initial}
                  className="w-[22px] h-[22px] rounded-full bg-brand-elevated border border-white/15
                    flex items-center justify-center text-[9px] font-medium text-gray-400"
                  style={{ zIndex: 5 - i }}
                >
                  {initial}
                </span>
              ))}
            </div>
            <p className="text-[11.5px] text-gray-500">
              Join <span className="text-gray-300">300+ traders</span> already journaling with TradeX
            </p>
          </div>
        </div>

        {/*
          The product, before anyone scrolls.

          This is the piece the page never had: a visitor could read the whole
          hero without seeing that TradeX is software. It is the real interface
          - the app's own tokens, type and profit/loss colours - rendered live
          rather than screenshotted, so it stays sharp on every display and
          cannot go stale when the product changes.

          Figures are an example, and the panel says so.
        */}
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pb-20 sm:pb-28">
          <div className="relative rounded-2xl border border-white/10 bg-brand-surface overflow-hidden shadow-[0_0_60px_-15px_rgba(255,255,255,0.08)]">
            {/* window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-brand-elevated">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <span className="ml-2 text-[11px] text-gray-600 tracking-wide">Dashboard</span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: 'Net P&L', value: '+$4,812', tone: 'text-brand-profit' },
                  { label: 'Win rate', value: '58%', tone: 'text-white' },
                  { label: 'Profit factor', value: '1.94', tone: 'text-white' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/[0.07] bg-brand-elevated px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-gray-600">{stat.label}</p>
                    <p className={`mt-1.5 text-lg sm:text-2xl font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* equity curve - one path, drawn to the box */}
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-brand-elevated p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600">Equity</p>
                  <p className="text-[11px] text-gray-600">Last 30 days</p>
                </div>
                <svg viewBox="0 0 320 72" className="w-full h-16 sm:h-20" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="heroEquityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 60 L32 55 L64 58 L96 44 L128 47 L160 33 L192 36 L224 22 L256 26 L288 14 L320 8 L320 72 L0 72 Z" fill="url(#heroEquityFill)" />
                  <path d="M0 60 L32 55 L64 58 L96 44 L128 47 L160 33 L192 36 L224 22 L256 26 L288 14 L320 8" fill="none" stroke="#60A5FA" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>

              {/* what makes it TradeX rather than a P&L tracker */}
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-brand-elevated p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600 mb-2.5">Journal &mdash; today</p>
                <p className="text-[13px] sm:text-sm text-gray-300 leading-relaxed">
                  &ldquo;Moved my stop twice on the EURUSD short. Same thing I did Tuesday.&rdquo;
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Moved stop', 'Revenge entry', 'Focus 4/10'].map((tag) => (
                    <span key={tag} className="text-[11px] text-gray-400 border border-white/10 rounded-full px-2.5 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-600">Example figures</p>
        </div>
      </div>

      {/*
        HOW IT WORKS.

        The research on this is consistent: a visitor's second question after
        "what do I get" is "how does this actually work". Three steps, in the
        order they happen, each with the interface moment that proves it.

        Replaced about 1,100 lines of animated mock dashboards. They were
        impressive and nobody read them - too much to take in, and every one
        of them competed with the others for the same attention.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              How it works
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Thirty seconds a trade
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              The reason journals die is the typing. So TradeX takes it off you.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:gap-5">
            {[
              {
                step: '01',
                title: 'Say what happened',
                body: 'Hit record and talk like you would to a trading partner. Rambling is fine.',
                visual: (
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
                    </span>
                    <div className="flex items-end gap-[3px] h-7" aria-hidden="true">
                      {[7, 14, 22, 12, 26, 18, 9, 20, 28, 15, 8, 19, 24, 11, 6].map((h, i) => (
                        <span key={i} className="w-[3px] rounded-full bg-white/25" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                step: '02',
                title: 'It writes the entry',
                body: 'Symbol, direction, size, P&L and your reasoning, pulled out and filed where they belong.',
                visual: (
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    {[
                      ['Symbol', 'EURUSD'],
                      ['Direction', 'Short'],
                      ['Size', '0.5 lots'],
                      ['Result', '-$180'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 rounded-lg border border-white/[0.07] px-2.5 py-1.5">
                        <span className="text-gray-600">{k}</span>
                        <span className="text-gray-300 tabular-nums">{v}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                step: '03',
                title: 'It tells you what you keep doing',
                body: 'Across every entry, not just this one. The pattern you cannot see from inside it.',
                visual: (
                  <div className="rounded-lg border border-brand-blue-light/20 bg-brand-blue/[0.06] px-3 py-2.5">
                    <p className="text-[12.5px] leading-relaxed text-gray-300">
                      You moved your stop on <span className="text-white">4 of your last 6 losers</span>.
                      None of your winners.
                    </p>
                  </div>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7
                  sm:grid sm:grid-cols-[1fr_minmax(0,300px)] sm:gap-8 sm:items-center"
              >
                <div>
                  <p className="text-[10px] tracking-[0.18em] text-gray-600 mb-2.5 tabular-nums">{item.step}</p>
                  <h3 className="text-[19px] sm:text-xl font-semibold text-white tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] sm:text-sm text-gray-400 leading-relaxed">{item.body}</p>
                </div>
                <div className="mt-5 sm:mt-0 rounded-xl border border-white/[0.06] bg-brand-elevated p-4">
                  {item.visual}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/*
        THE DIFFERENTIATOR.

        Every journal shows P&L. This is the one thing no competitor leads
        with, so it gets a section to itself rather than a card in a grid.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Psychology
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Your P&amp;L is the symptom
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              TradeX scores how you felt going in, then matches it against what
              actually happened. That is where the money is.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-6">
              {[
                { label: 'Focus', value: 7, of: 10 },
                { label: 'Confidence', value: 4, of: 10 },
                { label: 'Discipline', value: 6, of: 10 },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-white/[0.07] bg-brand-elevated p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">{m.label}</p>
                  <p className="mt-1.5 text-xl sm:text-2xl font-semibold text-white tabular-nums">
                    {m.value}<span className="text-gray-600 text-sm">/{m.of}</span>
                  </p>
                  <div className="mt-2.5 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-blue-light/70" style={{ width: `${m.value * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-brand-elevated p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mb-2">What it found</p>
              <p className="text-[13.5px] sm:text-[15px] text-gray-300 leading-relaxed">
                Every trade you rated <span className="text-white">confidence below 5</span> lost money.
                Nine out of nine. You are not losing on setups &mdash; you are losing on the days you
                already knew you should sit out.
              </p>
            </div>
            <p className="mt-4 text-center text-[11px] text-gray-600">Example figures</p>
          </div>
        </div>
      </div>

      {/*
        THE OBJECTION.

        Almost nobody arrives using nothing - they use a spreadsheet and half
        believe it is fine. Naming that directly converts better than listing
        features, because the comparison is the argument they are already
        having with themselves.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              &ldquo;I already have a spreadsheet&rdquo;
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              You do. Be honest about how up to date it is.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-4 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-600 mb-4">Spreadsheet</p>
              <ul className="flex flex-col gap-3">
                {[
                  'You type every row',
                  'Blank after a bad week',
                  'Tells you what, never why',
                  'No memory of your state',
                ].map((t) => (
                  <li key={t} className="text-[12.5px] sm:text-sm text-gray-500 leading-snug">{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/15 bg-brand-surface p-4 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-4">TradeX</p>
              <ul className="flex flex-col gap-3">
                {[
                  'You talk, it types',
                  'Thirty seconds, so it gets done',
                  'Finds the pattern across every trade',
                  'Scores your head, not just the result',
                ].map((t) => (
                  <li key={t} className="text-[12.5px] sm:text-sm text-gray-200 leading-snug">{t}</li>
                ))}
              </ul>
            </div>
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
                Your browser doesn't support embedded video. You can still sign up
                below.
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
            {/*
              The card below already switches on `launched`; this line was
              missed, so it went on inviting people to join the waitlist and
              lock in founding member pricing well after both had ended -
              offering a price checkout would not honour, right above the card
              charging the real one.
            */}
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">
              {launched
                ? 'Everything included in one plan \u2014 no tiers, no add-ons.'
                : 'Join the waitlist before launch and lock in founding member pricing.'}
            </p>
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
                {/*
                  Pre-launch the badge earns its place by saying something the
                  heading doesn't - that this is founder pricing. After launch
                  there is no second thing to say, and repeating "TradeX Pro"
                  directly above the heading that already says it just adds
                  noise, so it comes off entirely.
                */}
                {!launched && (
                  <div className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 mb-4">
                    Founding Member Pricing
                  </div>
                )}
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
                    ? 'Cancel anytime'
                    : 'Locked in forever • Cancel anytime'}
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