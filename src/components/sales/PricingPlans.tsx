import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { TIERS, PLAN_CHECKLIST, type Tier } from '../../lib/pricingTiers';

/*
  The landing page's plans, Tradespad-style: a card per plan, its contents
  ticked, what it lacks faded.

  This replaced three bare rows - a name, a price, an account count - over
  a separate "every plan includes" box. Brandon, on his phone: it "doesn't
  really look attractive at all", and the rows assumed the reader already
  knew what was in a plan. A card that lists its own contents answers that
  where the price is, which is where the question gets asked.

  ON A PHONE, ONE CARD AND A SWITCHER

  Three full cards stacked at 375px is three screens of nearly identical
  ticks. Instead the plans are a three-way switch over one card, opening on
  the featured plan; tapping Starter or Elite swaps the card in place, and
  the faded rows change as you go, which shows what the difference between
  them actually is better than reading three lists would. From md up there
  is room for all three side by side, and they are shown that way.
*/

function stripMarks(s: string) {
  return s.replace(/\*/g, '');
}

function PlanCard({ tier, launched, className = '' }: { tier: Tier; launched: boolean; className?: string }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        tier.featured
          ? 'border-brand-blue/40 bg-gradient-to-b from-brand-blue/[0.09] to-brand-surface shadow-[0_0_60px_-20px_rgba(59,130,246,0.45)]'
          : 'border-white/[0.08] bg-brand-surface'
      } ${className}`}
    >
      {tier.featured && (
        <span className="absolute -top-2.5 left-6 rounded-full bg-brand-blue px-2.5 py-0.5
          text-[10px] font-medium text-white whitespace-nowrap">
          Most popular
        </span>
      )}

      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{tier.name}</p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-[38px] font-semibold tracking-[-0.035em] text-white tabular-nums leading-none">
          {tier.price}
        </span>
        <span className="text-[13px] text-gray-500">/month</span>
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-400 min-h-[2.6em]">{stripMarks(tier.who)}</p>

      {launched && (
        <Link
          to="/auth?mode=signup"
          className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-medium
            transition-colors ${
              tier.featured
                ? 'bg-white text-black hover:bg-gray-200'
                : 'border border-white/[0.12] text-white hover:bg-white/[0.06]'
            }`}
        >
          Start 14 days free
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}

      <ul className="mt-6 pt-5 border-t border-white/[0.07] flex flex-col gap-3">
        <li className="flex gap-2.5 text-[13px] leading-snug text-white font-medium">
          <Check className="mt-[2px] w-4 h-4 flex-shrink-0 text-brand-blue" strokeWidth={2.5} />
          {tier.syncedLabel} automatically
        </li>
        {PLAN_CHECKLIST.map((row) => {
          const has = row.in.includes(tier.name);
          return (
            <li
              key={row.text}
              className={`flex gap-2.5 text-[13px] leading-snug ${has ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <Check
                className={`mt-[2px] w-4 h-4 flex-shrink-0 ${has ? 'text-brand-blue' : 'text-white/[0.14]'}`}
                strokeWidth={2.5}
              />
              <span className={has ? '' : 'line-through decoration-white/15'}>
                {row.text}
                {!has && <span className="sr-only"> (not included)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PricingPlans({ launched }: { launched: boolean }) {
  const startAt = Math.max(0, TIERS.findIndex((t) => t.featured));
  const [picked, setPicked] = useState(startAt);

  return (
    <div>
      {/* Phone: a switch over one card. */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Plans" className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-brand-surface p-1">
          {TIERS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={picked === i}
              onClick={() => setPicked(i)}
              className={`rounded-lg py-2 text-center transition-colors duration-300 ${
                picked === i ? 'bg-white/[0.08] text-white' : 'text-gray-500'
              }`}
            >
              <span className="block text-[12.5px] font-medium">{t.name}</span>
              <span className="block text-[11px] tabular-nums opacity-70">{t.price}</span>
            </button>
          ))}
        </div>
        <div className="mt-5">
          {/* Keyed, so the swap fades in rather than the text changing under the reader's thumb. */}
          <div key={picked} className="animate-plan-in motion-reduce:animate-none">
            <PlanCard tier={TIERS[picked]} launched={launched} />
          </div>
        </div>
      </div>

      {/* md and up: all three. */}
      <div className="hidden md:grid grid-cols-3 gap-4 lg:gap-5 items-stretch">
        {TIERS.map((t) => (
          <PlanCard key={t.name} tier={t} launched={launched} />
        ))}
      </div>
    </div>
  );
}
