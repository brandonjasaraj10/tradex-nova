import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import NOVAScore from '../components/shared/NOVAScore';
import { Section, TickList, QA, Steps, ClosingCta } from '../components/marketing/blocks';
import { Frame, PullQuote, StatBand } from '../components/marketing/product';
import { EXAMPLE_SCORE } from '../components/marketing/exampleScore';
import { useHasLaunched } from '../lib/launch';

/*
  Pricing, on its own page, because people search for it by name and a price
  two-thirds of the way down a long landing page is one a comparison shopper
  never finds.

  One plan, one card. No three-column tier table with a "most popular" badge
  in the middle - there is one product, and inventing tiers so the middle one
  looks chosen is exactly the kind of thing this audience notices.

  The card is the whole page's centre of gravity, so it gets the width and
  everything else is arranged around it. The research on pricing pages is
  specific about the order: plan name, benefit line, price, features, one
  primary CTA - and burying the price under a wall of bullets adds friction a
  scannable card avoids. Hence the price before the feature list, not after.

  The numbers live in one place. They used to be typed by hand in several,
  which is how a site ends up advertising two different prices.
*/

const MONTHLY_PRICE = '$24.99';
const FOUNDING_PRICE = '$14.99';

/*
  Six, not fourteen, and each one an outcome rather than a feature name.

  The research on pricing pages puts the useful range at five to seven
  bullets, and is specific about why: a bullet should answer "what do I
  get?", not "what is included?". Fourteen line items is an inventory, and
  an inventory is read by nobody - a documented case cut its feature list,
  its tier count and added a Most Popular badge and went from 1.2% to 3.1%
  conversion without touching the price.

  The old list also repeated itself. "Psychology template & scoring" and
  "NOVA Score" are the same promise twice; "Performance analytics",
  "Trading calendar" and "Searchable trade log" are three names for looking
  at your own trades. Grouping them loses nothing a buyer needed and stops
  the list arguing with itself about how many things this product does.

  What is NOT dropped is the detail underneath. "Up to 5 accounts" and "CSV
  import" are facts somebody comparing products will look for, so they stay
  - as one quiet line rather than four bullets competing with the six that
  do the selling.
*/
const INCLUDED = [
  'Talk through a trade \u2014 it writes itself up',
  'Nova reads every entry and tells you what you keep doing',
  'Your psychology scored on every trade, not just P&L',
  'Your own rules and checklists, checked before you enter',
  'Calendar, analytics and every trade searchable',
  'Weekly and monthly reviews, written for you',
];

/* The specifics a comparison shopper checks, kept but not shouted. */
const ALSO_INCLUDED = 'Unlimited trades \u00b7 Up to 5 accounts \u00b7 CSV import \u00b7 Notes';

export default function Pricing() {
  const launched = useHasLaunched();

  return (
    <PageShell
      width="wide"
      eyebrow="Pricing"
      title="One plan. Everything in it."
      subtitle="No tiers, no add-ons, no trade limits, and no feature held back to sell you later."
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-6 lg:gap-10 items-start">
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
              <span className="text-[52px] leading-none sm:text-6xl font-semibold text-white tracking-[-0.035em] tabular-nums">
                {launched ? MONTHLY_PRICE : FOUNDING_PRICE}
              </span>
              <span className="text-[15px] text-gray-500">/month</span>
            </p>
            <p className="mt-3 text-[12.5px] text-gray-500">
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
            <p className="mt-4 text-[12px] text-gray-500 leading-relaxed">
              {ALSO_INCLUDED}
            </p>
          </div>

          <Link
            to="/auth?mode=signup"
            className="w-full inline-flex items-center justify-center px-7 py-3.5 rounded-full
              bg-white text-black text-[14.5px] font-medium hover:bg-gray-200 transition-colors"
          >
            Start journaling
          </Link>
          <p className="mt-3 text-center text-[11.5px] text-gray-500">
            Cancel in two clicks. No retention call.
          </p>
        </div>

        {/*
          What the money buys, beside the number rather than under it. A price
          on its own is a cost; a price next to the thing it produces is a
          trade. This is the real NOVAScore component, not a picture of one.
        */}
        <div className="flex flex-col gap-5">
          <Frame label="What you get from it" note="Example figures">
            <NOVAScore breakdown={EXAMPLE_SCORE} size="md" showBreakdown periodLabel="Last 30 days" />
          </Frame>
          <p className="text-[13.5px] leading-relaxed text-gray-400">
            Every feature on the list feeds one thing: knowing whether you are
            actually getting better, and what specifically is holding you back.
            That is what the subscription is for.
          </p>
        </div>
      </div>

      <div className="my-12 sm:my-16">
        <StatBand
          items={[
            { value: '14', label: 'Days money back, no questions asked' },
            { value: '2', label: 'Clicks to cancel, from Settings' },
            { value: '$0', label: 'Of your card ever stored by us' },
          ]}
        />
      </div>

      <Section title="Getting started takes about a minute" lead="There is nothing to connect and nothing to configure.">
        <Steps
          items={[
            {
              title: 'Make an account',
              body: 'Email and a password. No broker credentials, no card details beyond the subscription itself.',
            },
            {
              title: 'Get your trades in',
              body: 'Upload the CSV your broker exports to bring your history across, or just start talking through trades as you take them.',
            },
            {
              title: 'Ask Nova something',
              body: 'Once there is history to read, ask it what your worst habit is. That is the moment the subscription either earns its place or does not.',
            },
          ]}
        />
      </Section>

      <PullQuote>
        Fourteen days is longer than most people last with a journal. That is
        rather the point.
      </PullQuote>

      <Section title="The questions people actually ask before paying">
        <QA
          items={[
            {
              q: 'Is there a free trial?',
              a: 'There is a 14-day money back guarantee instead, which does the same job without the part where a card gets charged on a day you forgot about. Give it two proper weeks. If you are still not journaling, or it has not shown you something about how you trade that you did not already know, ask for your money back.',
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
              a: 'Card only for now, handled by Stripe. Your card details never reach TradeX.',
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
