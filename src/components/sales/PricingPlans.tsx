import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { TIERS, PLAN_CHECKLIST, annualPricing, type Tier } from '../../lib/pricingTiers';

type Billing = 'monthly' | 'yearly';

const shownPrice = (tier: Tier, billing: Billing) =>
  billing === 'yearly' ? annualPricing(tier).perMonth : tier.price;

/*
  The landing page's plans: a card per plan, listing what it contains.

  This replaced three bare rows - a name, a price, an account count - over
  a separate "every plan includes" box. Brandon, on his phone: it "doesn't
  really look attractive at all", and the rows assumed the reader already
  knew what was in a plan. A card that lists its own contents answers that
  where the price is, which is where the question gets asked.

  ON A PHONE, A ROW YOU SWIPE, WITH A SWITCH ABOVE IT

  Three full cards stacked at 375px is three screens of nearly identical
  ticks. So the cards sit in a horizontal row, opening on the featured plan
  with its neighbours showing at the edges, and the Starter / Pro / Elite
  switch above follows the swipe - or drives it, when tapped. From md up
  there is room for all three side by side, and they are shown that way.
*/

const CARD_W = 86; /* percent of the row, on a phone */
const SIDE = (100 - CARD_W) / 2;
const GAP = 12; /* px - must match gap-3 below */

function stripMarks(s: string) {
  return s.replace(/\*/g, '');
}

function PlanCard({ tier, billing, launched, className = '' }: { tier: Tier; billing: Billing; launched: boolean; className?: string }) {
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
          {shownPrice(tier, billing)}
        </span>
        <span className="text-[13px] text-gray-500">/month</span>
      </p>
      {/*
        Always one line here, whichever is picked, so the cards do not change
        height under the reader when they flip the toggle. The yearly total is
        stated rather than left to arithmetic: a page that advertises a
        per-month figure and then charges a year up front, unannounced, is
        how chargebacks start.
      */}
      <p className="mt-2 text-[12px] text-gray-500 tabular-nums">
        {billing === 'yearly' ? (
          <>
            {annualPricing(tier).total} billed yearly{' '}
            <span className="text-brand-blue">&middot; 2 months free</span>
          </>
        ) : (
          'Billed monthly'
        )}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-400 min-h-[2.6em]">{stripMarks(tier.who)}</p>

      {/* White on every plan - Brandon's call. The featured card is already marked by its border and badge. */}
      {launched && (
        <Link
          to="/auth?mode=signup"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-medium
            bg-white text-black hover:bg-gray-200 transition-colors"
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
        {PLAN_CHECKLIST.filter((row) => row.in.includes(tier.name)).map((row) => (
          <li key={row.text} className="flex gap-2.5 text-[13px] leading-snug text-gray-300">
            <Check className="mt-[2px] w-4 h-4 flex-shrink-0 text-brand-blue" strokeWidth={2.5} />
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPlans({ launched }: { launched: boolean }) {
  const startAt = Math.max(0, TIERS.findIndex((t) => t.featured));
  const [picked, setPicked] = useState(startAt);
  const [billing, setBilling] = useState<Billing>('monthly');
  const rowRef = useRef<HTMLDivElement | null>(null);
  const sliding = useRef(false);

  const stepOf = (el: HTMLDivElement) => {
    const card = el.querySelector<HTMLElement>('[data-plan]');
    return card ? card.offsetWidth + GAP : el.clientWidth;
  };

  /* Open on the featured plan, without animating there. */
  useEffect(() => {
    const el = rowRef.current;
    if (el) el.scrollLeft = startAt * stepOf(el);
  }, [startAt]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (sliding.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPicked(Math.min(TIERS.length - 1, Math.round(el.scrollLeft / Math.max(1, stepOf(el)))));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /*
    A tapped plan slides there frame by frame with snapping paused, the same
    way SwipeDeck does it - a smooth scrollTo into a snapping row is what
    overshot and bounced on an iPhone in the psychology section.
  */
  const pick = (i: number) => {
    const el = rowRef.current;
    setPicked(i);
    if (!el) return;
    const target = Math.min(i * stepOf(el), el.scrollWidth - el.clientWidth);
    const from = el.scrollLeft;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 450;
    const began = performance.now();
    sliding.current = true;
    el.style.scrollSnapType = 'none';
    const finish = () => {
      el.scrollLeft = target;
      el.style.scrollSnapType = '';
      sliding.current = false;
    };
    if (duration === 0) return finish();
    const frame = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      el.scrollLeft = from + (target - from) * (1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
  };

  const spacer = (
    <span aria-hidden="true" className="flex-shrink-0" style={{ flexBasis: `calc(${SIDE}% - ${GAP}px)` }} />
  );

  return (
    <div>
      {/*
        Monthly or yearly, kept small - it changes the numbers, not the
        choice, so it should not compete with the plan switch under it.
        Opens on monthly, the figure people compare against other journals.
      */}
      <div className="mb-5 flex items-center gap-3">
        <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-full border border-white/[0.08] bg-brand-surface p-0.5">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={billing === b}
              onClick={() => setBilling(b)}
              className={`rounded-full px-3.5 py-1 text-[12px] capitalize transition-colors duration-300 ${
                billing === b ? 'bg-white/[0.1] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-brand-blue">2 months free yearly</span>
      </div>

      {/* Phone: a switch over a row of cards. */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Plans" className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-brand-surface p-1">
          {TIERS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={picked === i}
              onClick={() => pick(i)}
              className={`rounded-lg py-2 text-center transition-colors duration-300 ${
                picked === i ? 'bg-white/[0.08] text-white' : 'text-gray-500'
              }`}
            >
              <span className="block text-[12.5px] font-medium">{t.name}</span>
              <span className="block text-[11px] tabular-nums opacity-70">{shownPrice(t, billing)}</span>
            </button>
          ))}
        </div>

        {/*
          Bleeds to the screen edges so the neighbouring cards peek in from
          the sides - the cue that there is something to swipe to. pt-3 is
          room for the Most popular badge, which sits above its card's edge
          and would otherwise be clipped by the row's overflow.
        */}
        <div
          ref={rowRef}
          className="-mx-5 mt-3 pt-3 pb-2 flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {spacer}
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              data-plan
              style={{ width: `${CARD_W}%` }}
              className={`flex-shrink-0 snap-center flex transition-opacity duration-300 ${
                picked === i ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <PlanCard tier={t} billing={billing} launched={launched} className="w-full" />
            </div>
          ))}
          {spacer}
        </div>
      </div>

      {/* md and up: all three. */}
      <div className="hidden md:grid grid-cols-3 gap-4 lg:gap-5 items-stretch">
        {TIERS.map((t) => (
          <PlanCard key={t.name} tier={t} billing={billing} launched={launched} />
        ))}
      </div>
    </div>
  );
}
