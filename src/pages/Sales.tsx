import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Brain, Target, LineChart, Zap, AlertTriangle, ChevronRight, School as Psychology, TrendingUp, Eye, Clock, BarChart2, Sparkles, Calendar, BookOpen, ChevronLeft, Plus, Smile, Meh, Frown, DollarSign, Award, MessageSquare, Check } from 'lucide-react';
import Button from '../components/shared/Button';
import Footer from '../components/layout/Footer';
import TranscriptToEntry from '../components/sales/TranscriptToEntry';
import ProductTabs from '../components/sales/ProductTabs';
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

          <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-4">
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
                  /* The Dashboard's own labels, so the page and the product
                     call the same numbers the same things. */
                  { label: 'Total P&L', value: '+$4,812', tone: 'text-brand-profit' },
                  { label: 'Win Rate', value: '58%', tone: 'text-white' },
                  { label: 'Profit Factor', value: '1.94', tone: 'text-white' },
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
                    {/* Blue here on purpose - this is the record button, and it
                        is blue in the product. One accent, where it is literal. */}
                    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-blue/15 border border-brand-blue-light/30 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-blue-light" />
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
                visual: <TranscriptToEntry />,
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
        THE PRODUCT, EXPLORABLE.

        Placed here rather than in the hero on the evidence: Notre Dame found
        ~1% of visitors click a hero carousel at all and 84% of those clicks
        land on the first panel, and carousel-versus-static A/B testing
        measured 1.96% interaction against 43.03%. Hyros and TradeZella both
        put their own tabs mid-page for the same reason.

        The hero keeps one static panel carrying one message. This is for the
        visitor who is still reading and now wants to see more.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Inside TradeX
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Have a look around
            </h2>
          </div>
          <ProductTabs />
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
                  {/*
                    Tracking and size drop on mobile because "CONFIDENCE" at
                    10px/0.12em is wider than a third of a 375px screen and was
                    running into the card's right border.
                  */}
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.04em] sm:tracking-[0.12em] text-gray-600 whitespace-nowrap">{m.label}</p>
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
        NOVA.

        The product is named after her and the page never said what she does.
        Kept to one section and one exchange rather than a feature grid: what
        makes Nova worth paying for is that she has read every entry, so the
        demonstration is an answer no generic chatbot could give.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Nova
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Ask her anything about your trading
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              She has read every entry you have written. Not generic advice &mdash;
              your trades, your numbers, your habits.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7">
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
                  px-4 py-2.5 text-[13px] sm:text-sm text-gray-300">
                  Why am I losing on Fridays?
                </p>
              </div>

              <div className="flex gap-2.5">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-blue/15 border border-brand-blue-light/30
                  flex items-center justify-center text-[10px] font-medium text-brand-blue-light">
                  N
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-brand-blue/[0.06] border border-brand-blue-light/20
                  px-4 py-3 text-[13px] sm:text-sm text-gray-300 leading-relaxed">
                  You are not. You are losing on the days you rate your focus below 5,
                  and eleven of those fourteen days were Fridays. Your Friday setups win
                  at the same rate as the rest of the week &mdash; you just size up on them
                  after a flat week.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['Reads every entry', 'Not just the last one. Patterns show up across months, not trades.'],
                ['Remembers you', 'Tell her once what you are working on and she holds on to it.'],
                ['Writes your entries', 'Talk it through and she files the whole thing for you.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <p className="text-[12.5px] font-medium text-white">{title}</p>
                  <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-[11px] text-gray-600">Example conversation</p>
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
      {/*
        A founder on camera is the strongest trust signal a small brand has.
        Competitors answer this slot with customer logos and five-figure user
        counts; we cannot, and imitating them with invented proof would be
        the one thing on this page that could not be defended. A real person
        saying why they built it beats a fake logo wall.

        Kept from the old page, restyled to match: no badge pill, no blue
        wash, same type scale as every other section.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 relative">
          <div>
            <div className="text-center mb-10 sm:mb-12">
              <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
                From the founder
              </p>
              <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
                Why I built this
              </h2>
              <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
                I kept quitting my own trading journal. So I built the one I would actually keep.
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
          </div>
        </div>
      </div>

      {/*
        PRICING.

        High-converting SaaS pages show the price rather than hiding it behind
        a demo request - the visitor's fourth question is what it costs, and
        making them ask loses the ones who would have paid.

        One plan, so the layout is one card rather than a three-column tier
        table with a fake "most popular" badge. Features are a plain list, not
        three columns of categories: what matters here is that nothing is held
        back, and a wall of ticks says that better than taxonomy.

        The gold-* classes this section used were undefined and rendered as
        nothing, which is why the old feature headings had no colour at all.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Pricing
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              One plan. Everything in it.
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
              {launched
                ? 'No tiers, no add-ons, no trade limits.'
                : 'Join the waitlist before launch and lock in founding member pricing.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-brand-surface p-6 sm:p-8">
            <div className="text-center pb-7 mb-7 border-b border-white/[0.07]">
              {!launched && (
                <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-3">
                  Founding member pricing
                </p>
              )}
              <p className="flex items-baseline justify-center gap-1.5">
                {!launched && (
                  <span className="text-xl text-gray-600 line-through mr-1 tabular-nums">$24.99</span>
                )}
                <span className="text-[44px] sm:text-5xl font-semibold text-white tracking-[-0.03em] tabular-nums">
                  {launched ? '$24.99' : '$14.99'}
                </span>
                <span className="text-[15px] text-gray-500">/month</span>
              </p>
              <p className="mt-2 text-[12.5px] text-gray-500">
                {launched ? '14-day money back guarantee \u00b7 Cancel anytime' : 'Locked in forever \u00b7 Cancel anytime'}
              </p>
            </div>

            {/*
              Real urgency, not a countdown clock.

              MT4 and MT5 sync ships in the next week or two and the price
              goes up with it. Saying so is both the honest warning and the
              strongest reason to join today - and unlike a fake timer, it is
              a promise that can actually be kept.
            */}
            {launched && (
              <div className="mb-7 rounded-xl border border-brand-blue-light/25 bg-brand-blue/[0.06] px-4 py-3.5">
                <p className="text-[12.5px] sm:text-[13px] text-gray-300 leading-relaxed">
                  <span className="text-white font-medium">MT4 &amp; MT5 sync lands in the next couple of weeks</span>
                  {' \u2014 '}and the price goes up when it does. Join now and yours stays at $24.99.
                </p>
              </div>
            )}

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 mb-7">
              {[
                'Voice journaling',
                'Nova AI analysis',
                'Psychology scoring',
                'Unlimited trades',
                'Up to 5 accounts',
                'CSV import',
                'Performance analytics',
                'Trading rules & confluences',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[13.5px] text-gray-300">
                  <Check className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" strokeWidth={3} />
                  {feature}
                </li>
              ))}
            </ul>

            {launched ? (
              <Link
                to="/auth?mode=signup"
                className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5
                  rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
              >
                Start journaling
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <SignupOrWaitlist
                preLaunchFootnote={
                  <p className="text-center text-[12.5px] text-gray-500 mt-4">
                    Join now to lock in $14.99/mo &mdash; this price ends at launch
                  </p>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/*
        FAQ.

        Only the questions that stop a card coming out. A FAQ that explains
        features is a second feature list; this one answers the four things a
        sceptical trader actually thinks, in their words, and the security one
        sits first because it is the one that stops broker connections.

        Plain <details> rather than state-driven accordions: it works without
        JavaScript, it is keyboard accessible for free, and the answer is in
        the DOM for search engines whether or not anyone opens it.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Before you ask
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              The honest answers
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              {
                /*
                  The doubt underneath every other question, and the one
                  TradeZella leads their own FAQ with. Answering it honestly -
                  including the condition - reads as more credible than a
                  promise.
                */
                q: 'Does journaling actually work?',
                a: 'Only if you keep doing it. That is the whole problem, and it is what TradeX is built around \u2014 a journal you abandon in week three teaches you nothing, however good its charts are. Thirty seconds of talking is a habit people keep.',
              },
              {
                q: 'Can I connect my broker?',
                a: 'Right now you import a CSV from your broker or add trades as you go. Direct MT4 and MT5 sync lands in the next couple of weeks, and it is read-only when it does \u2014 TradeX will see your trade history and nothing else. It can never place, close or modify a trade, and it never touches your money.',
              },
              {
                q: 'How is this different from a spreadsheet?',
                a: 'You stop typing. You talk through the trade and TradeX writes the entry, then reads every entry together and tells you what you keep doing \u2014 which a spreadsheet has never once done for anybody.',
              },
              {
                q: 'I have tried journals before and quit. Why is this different?',
                a: 'Two reasons. The quitting is the problem we built around \u2014 journals do not fail on features, they fail at 4pm when typing up a trade is the last thing you want to do. And every other journal shows you your P&L. TradeX records how you felt going in and matches it against what happened, because seeing that you lost and seeing why you lost are different things.',
              },
              {
                /*
                  Worth answering plainly: this product asks people to record
                  their state of mind, which is more personal than a P&L.
                */
                q: 'Who can see what I write?',
                a: 'Only you. Your entries, your psychology scores and your conversations with Nova are yours \u2014 they are not shown to other users and they are not sold to anyone. You can export or delete everything from Settings.',
              },
              {
                q: 'What if it is not for me?',
                a: '14-day money back guarantee, no questions asked. Cancel any time from Settings in two clicks \u2014 no email, no retention call.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/[0.07] bg-brand-surface
                  open:border-white/15 transition-colors"
              >
                <summary
                  className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4
                    text-[14.5px] sm:text-[15px] font-medium text-white
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-xl"
                >
                  {item.q}
                  <Plus
                    className="w-4 h-4 flex-shrink-0 text-gray-500 transition-transform duration-200
                      group-open:rotate-45"
                    strokeWidth={2}
                  />
                </summary>
                <p className="px-5 pb-5 -mt-1 text-[13.5px] sm:text-sm text-gray-400 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/*
        Testimonials, restyled to match the rest of the page.

        Content unchanged - that is a decision already taken. What changed is
        the treatment: quote first and name second, because on a page this
        quiet the words carry more than an avatar circle does, and three
        heavy cards in a row was the last piece of the old visual language
        left standing.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Early users
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              What they say
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                quote: "NOVA's psychological insights helped me identify and fix my emotional trading patterns. My win rate improved by 35% in just two months.",
                name: 'Michael S.',
                role: 'Forex Trader',
                initials: 'MS',
              },
              {
                quote: 'The visual trade calendar and analytics helped me identify my most profitable setups. TradeX has completely transformed my trading approach.',
                name: 'Sarah L.',
                role: 'Options Trader',
                initials: 'SL',
              },
              {
                quote: "The detailed analytics and journaling features save me hours each week. NOVA's insights have helped me become more consistent and disciplined.",
                name: 'David K.',
                role: 'Crypto Trader',
                initials: 'DK',
              },
            ].map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-6"
              >
                <blockquote className="text-[13.5px] sm:text-sm text-gray-300 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-brand-elevated border border-white/10
                    flex items-center justify-center text-[10px] font-medium text-gray-400">
                    {t.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-gray-300 truncate">{t.name}</span>
                    <span className="block text-[11px] text-gray-600 truncate">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      {/*
        FINAL CTA.

        Same words as the hero button, deliberately. A page that says "Start
        journaling" at the top and "Transform Your Trading" at the bottom is
        offering two different things; repeating one verb makes it one
        decision the reader has now seen the case for.

        The old copy - "Join traders who have transformed their results" -
        claimed an outcome for people we cannot point to. The guarantee does
        the same job and is checkable.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
            Stop guessing why you lose
          </h2>
          <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
            Thirty seconds a trade. The pattern you cannot see from inside it.
          </p>

          {launched ? (
            <div className="mt-8 flex flex-col items-center gap-2.5">
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
          ) : (
            <div className="mt-8 max-w-md mx-auto">
              <SignupOrWaitlist
                preLaunchFootnote={
                  <p className="text-[11.5px] text-gray-500 mt-4">
                    Join before launch to lock in{' '}
                    <span className="line-through">$24.99</span>{' '}
                    <span className="text-gray-300">$14.99/mo</span>, forever.
                  </p>
                }
              />
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}