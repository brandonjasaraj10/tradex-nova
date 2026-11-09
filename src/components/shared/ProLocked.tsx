import { useNavigate } from 'react-router-dom';
import { Lock, Check } from 'lucide-react';

/*
  What a free user sees on a Pro screen, in place of the paywall bouncing them
  out of the app. Says what the screen does for them and offers the trial.

  Behind the card sits a blurred screenshot of the real screen (example data,
  from the landing page's shots, cropped to the content area), so they can see
  what they'd get without reading any numbers. A picture rather than the live
  page on purpose: the live Nova page would call paid-only tables and AI
  functions, and a brand-new account's analytics would blur to an empty page.
*/

const PREVIEW: Record<'analytics' | 'calendar' | 'nova', string> = {
  analytics: '/product/locked-analytics.jpg',
  calendar: '/product/locked-calendar.jpg',
  nova: '/product/locked-nova.jpg',
};

export type ProFeature = 'analytics' | 'calendar' | 'nova';

const COPY: Record<ProFeature, { title: string; lines: string[] }> = {
  analytics: {
    title: 'See what your trading is really telling you',
    lines: [
      'Win rate, profit factor and drawdown across every trade',
      'Which setups and sessions make you money, and which cost you',
      'How your mood and focus line up with your results',
    ],
  },
  calendar: {
    title: 'Your P&L, day by day',
    lines: [
      'Every trading day on one calendar, green and red at a glance',
      'Spot the days of the week that cost you',
      'Tap any day to see the trades and what you wrote',
    ],
  },
  nova: {
    title: 'Talk it through with Nova',
    lines: [
      'Ask Nova about any trade, any day, any pattern',
      'Nova remembers what you tell her between sessions',
      'Tips and insights drawn from your own journal',
    ],
  },
};

export default function ProLocked({ feature }: { feature: ProFeature }) {
  const navigate = useNavigate();
  const { title, lines } = COPY[feature];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0">
        <img
          src={PREVIEW[feature]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top blur-[5px] scale-105 opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/60" />
      </div>
      <div className="relative w-full max-w-md rounded-2xl bg-brand-surface/95 backdrop-blur-sm border border-white/[0.08] shadow-2xl shadow-black/60 p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-brand-blue/15 flex items-center justify-center mb-5">
          <Lock className="w-5 h-5 text-brand-blue-light" />
        </div>
        <p className="text-[12px] uppercase tracking-[0.12em] text-gray-500 mb-2">Pro</p>
        <h1 className="text-xl sm:text-2xl font-semibold text-white leading-snug [text-wrap:balance]">
          {title}
        </h1>
        <ul className="mt-5 space-y-3">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[14px] leading-relaxed text-gray-300">
              <Check className="w-4 h-4 text-brand-blue-light flex-shrink-0 mt-1" />
              {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigate('/payment')}
          className="mt-7 w-full inline-flex items-center justify-center px-6 py-3 rounded-full
            bg-white text-black text-[14.5px] font-medium hover:bg-gray-200 transition-colors"
        >
          Start 14 days free
        </button>
        <p className="mt-3 text-center text-[12px] text-gray-500">Cancel anytime. Your journal stays free.</p>
      </div>
    </div>
  );
}
