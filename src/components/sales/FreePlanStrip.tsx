import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { FREE_ENTRY_LIMIT, FREE_SCREENSHOT_LIMIT, FREE_VOICE_LIMIT, SIGNUP_CTA, SIGNUP_SUBLINE } from '../../lib/freePlan';

/*
  The free plan, laid out above the paid plans on the landing page.

  It answers the two questions a visitor has about a free tier before they
  will try it: what do I actually get, and what is held back. Both columns
  read from the same constants the database limits are mirrored in
  (lib/freePlan), so the page cannot promise a bigger allowance than the app
  enforces. Shown only with the free plan on.
*/

const INCLUDED = [
  `${FREE_ENTRY_LIMIT} journal entries a week`,
  'Unlimited notes (they never use up an entry)',
  `${FREE_VOICE_LIMIT} Nova voice entries a week, organised for you`,
  `${FREE_SCREENSHOT_LIMIT} chart screenshots per entry`,
  '1 trading account, logged by hand',
  'Your pre-trade checklist and psychology ratings',
];

const PRO_ADDS = [
  'Unlimited entries and Nova voice entries',
  'Analytics, the P&L calendar and your NOVA Score',
  'Chat with Nova about any trade or pattern',
  'MT4 / MT5 sync and statement import',
  'More accounts',
];

export default function FreePlanStrip() {
  return (
    <div className="mb-10 sm:mb-12 rounded-2xl border border-white/[0.08] bg-brand-surface p-6 sm:p-8">
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Free</p>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-[38px] font-semibold tracking-[-0.035em] text-white tabular-nums leading-none">$0</span>
            <span className="text-[13px] text-gray-500">forever</span>
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-gray-400">
            Everything you need to build the habit. Resets every Sunday night.
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {INCLUDED.map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-gray-300">
                <Check className="mt-[2px] w-4 h-4 flex-shrink-0 text-brand-blue" strokeWidth={2.5} />
                {line}
              </li>
            ))}
          </ul>
          <Link
            to="/auth?mode=signup"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-medium
              bg-white text-black hover:bg-gray-200 transition-colors w-full sm:w-auto"
          >
            {SIGNUP_CTA}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-2.5 text-[12px] text-gray-500">{SIGNUP_SUBLINE}</p>
        </div>

        <div className="md:border-l md:border-white/[0.07] md:pl-10 border-t border-white/[0.07] pt-6 md:border-t-0 md:pt-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Upgrade adds</p>
          <p className="mt-3 text-[15px] font-medium text-white text-balance">
            When you want Nova to read it all back to you
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {PRO_ADDS.map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-gray-400">
                <Lock className="mt-[2px] w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[12px] leading-relaxed text-gray-500">
            Any plan below, 14 days free to try. Your journal stays yours either way.
          </p>
        </div>
      </div>
    </div>
  );
}
