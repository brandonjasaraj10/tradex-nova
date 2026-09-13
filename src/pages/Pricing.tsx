import PageShell from '../components/layout/PageShell';
import { Link } from 'react-router-dom';
import { Section, TickList, QA, ClosingCta } from '../components/marketing/blocks';
import { useHasLaunched } from '../lib/launch';

/*
  Pricing, on its own page, because people search for it by name and because a
  price buried two-thirds of the way down a long landing page is a price a
  comparison shopper never finds.

  One plan, one card. No three-column tier table with a "most popular" badge
  in the middle - there is one product and inventing tiers to make the middle
  one look chosen is the kind of thing this audience notices.

  The numbers come from one place. They used to be typed out by hand in
  several, which is how a site ends up advertising two different prices.
*/

const MONTHLY_PRICE = '$24.99';
const FOUNDING_PRICE = '$14.99';

const INCLUDED = [
  'Voice journaling',
  'Nova AI analysis',
  'Psychology scoring',
  'NOVA Score',
  'Pre-trade checklists',
  'Weekly & monthly reports',
  'Trading rules & confluences',
  'Performance analytics',
  'Unlimited trades',
  'Up to 5 accounts',
  'CSV import',
  'Notes',
];

export default function Pricing() {
  const launched = useHasLaunched();

  return (
    <PageShell
      eyebrow="Pricing"
      title="One plan. Everything in it."
      subtitle="No tiers, no add-ons, no trade limits, and no feature held back to sell you later."
    >
      <div className="max-w-xl">
        <div className="rounded-2xl border border-white/10 bg-brand-surface p-6 sm:p-8">
          <div className="text-center pb-7 mb-7 border-b border-white/[0.07]">
            {!launched && (
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-3">
                Founding member pricing
              </p>
            )}
            <p className="flex items-baseline justify-center gap-1.5">
              {!launched && (
                <span className="text-xl text-gray-600 line-through mr-1 tabular-nums">
                  {MONTHLY_PRICE}
                </span>
              )}
              <span className="text-[44px] sm:text-5xl font-semibold text-white tracking-[-0.03em] tabular-nums">
                {launched ? MONTHLY_PRICE : FOUNDING_PRICE}
              </span>
              <span className="text-[15px] text-gray-500">/month</span>
            </p>
            <p className="mt-2 text-[12.5px] text-gray-500">
              {launched
                ? '14-day money back guarantee · Cancel anytime'
                : 'Locked in forever · Cancel anytime'}
            </p>
          </div>

          {/*
            Real urgency rather than a countdown clock. Sync genuinely ships in
            the next couple of weeks and the price genuinely goes up with it -
            which is both the honest warning and, unlike a fake timer, a
            promise that can actually be kept.
          */}
          {launched && (
            <div className="mb-7 rounded-xl border border-brand-blue-light/25 bg-brand-blue/[0.06] px-4 py-3.5">
              <p className="text-[12.5px] sm:text-[13px] text-gray-300 leading-relaxed">
                <span className="text-white font-medium">
                  MT4 &amp; MT5 sync lands in the next couple of weeks
                </span>
                {' — '}and the price goes up when it does. Join now and yours stays at{' '}
                {MONTHLY_PRICE}.
              </p>
            </div>
          )}

          <div className="mb-7">
            <TickList items={INCLUDED} />
          </div>

          <Link
            to="/auth?mode=signup"
            className="w-full inline-flex items-center justify-center px-7 py-3 rounded-full
              bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
          >
            Start journaling
          </Link>
        </div>
      </div>

      <Section
        title="What happens when you subscribe"
        lead="No surprises, because the surprises are what people actually brace for."
      >
        <QA
          items={[
            {
              q: 'Is there a free trial?',
              a: 'There is a 14-day money back guarantee instead, which does the same job without the part where a card gets charged on a day you forgot about. Use it properly for two weeks; if it is not for you, say so and you get your money back.',
            },
            {
              q: 'How do I cancel?',
              a: 'Two clicks in Settings. No email to send, no retention call, no "are you sure" chain. You keep access until the period you paid for ends.',
            },
            {
              q: 'Will the price go up on me later?',
              a: 'Not on you. The price is going up when MT4 and MT5 sync ships, but the rate you join at is the rate you keep.',
            },
            {
              q: 'What do I need to get started?',
              a: 'Nothing connected to your broker. Upload a CSV your broker exports, or just start talking through trades as you take them.',
            },
            {
              q: 'How many accounts can I track?',
              a: 'Up to five, each with its own trades, balance and analytics, and a selector to switch between them.',
            },
            {
              q: 'Do you take crypto or PayPal?',
              a: 'Card only for now, handled by Stripe.',
            },
          ]}
        />
      </Section>

      <ClosingCta
        title="Fourteen days to decide"
        body="If it does not change how you trade, ask for your money back."
      />
    </PageShell>
  );
}
