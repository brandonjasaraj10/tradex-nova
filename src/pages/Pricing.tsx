import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import { Section, QA, Steps, ClosingCta } from '../components/marketing/blocks';
import { PullQuote, StatBand } from '../components/marketing/product';

/*
  Pricing, on its own page, because people search for it by name and a price
  two-thirds of the way down a long landing page is one a comparison shopper
  never finds.

  This page used to argue against tiers, in this comment, on the grounds that
  inventing them so the middle one looks chosen is the sort of thing this
  audience notices. That was right while there was one product and every
  customer cost the same to serve. Broker syncing changes the fact it rested
  on: a live-synced account is a MetaTrader terminal hosted in the cloud on
  that trader's behalf, billed at $8.64 a month, every month, whether they
  log in or not. Six of those is $51.84 of somebody else's money before we
  have paid for anything else.

  So these tiers are not a persuasion device that happens to have features
  attached. They are the cost of the thing, passed on. The ordering research
  still applies - a highlighted middle column converts better, and it is used
  here - but the reason there are three columns at all is arithmetic.

  What is deliberately NOT tiered: everything that was already included when
  there was one plan. Voice journaling, psychology scoring, Nova, reports,
  the calendar, CSV import. Taking a feature somebody already pays for and
  putting it behind a higher tier is the version of this that earns the
  cynicism the old comment was worried about. The tiers gate capacity that
  costs us money - synced accounts, sync frequency, Nova volume - and nothing
  else.

  The numbers live in one place. They used to be typed by hand in several,
  which is how a site ends up advertising two different prices.
*/

type Tier = {
  name: string;
  price: string;
  /* Who this is for, in their words rather than ours. */
  who: string;
  /*
    What the money actually buys, written as the outcome rather than the
    specification. "Closed trades appear on their own, once a day" beats
    "1x daily sync interval" - the first is a thing that happens to you, the
    second is a row in a table.
  */
  lines: { text: string; included: boolean }[];
  cta: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$29.99',
    who: 'One account, and you would rather not type it up yourself.',
    lines: [
      { text: 'One account, syncing on its own', included: true },
      { text: 'Yesterday’s trades, waiting each morning', included: true },
      { text: 'Add or import as many accounts as you like', included: true },
      { text: '25 questions a day for Nova', included: true },
      { text: 'Trades that land while you are still at the screen', included: false },
    ],
    cta: 'Start journaling',
  },
  {
    name: 'Pro',
    price: '$59.99',
    who: 'A few accounts running, and you write trades up while they are fresh.',
    lines: [
      { text: 'Three accounts, syncing on their own', included: true },
      { text: 'Trades land minutes after you close them', included: true },
      { text: 'Add or import as many accounts as you like', included: true },
      { text: '100 questions a day for Nova', included: true },
      { text: 'More synced accounts whenever, $15 each', included: true },
    ],
    cta: 'Start journaling',
    featured: true,
  },
  {
    name: 'Elite',
    price: '$149.99',
    who: 'Several funded accounts at once, where a missed day is real money.',
    lines: [
      { text: 'Six accounts, syncing on their own', included: true },
      { text: 'Trades land minutes after you close them', included: true },
      { text: '300 questions a day — you will not reach it', included: true },
      { text: 'First on every new platform we connect', included: true },
      { text: 'Your support goes to the front of the queue', included: true },
    ],
    cta: 'Start journaling',
  },
];

/*
  In every plan, listed once rather than three times.

  Repeating identical ticks down three columns is how a pricing table
  becomes a wall nobody reads. The columns carry only what differs;
  everything shared sits underneath, where it reassures without competing.

  The WORDING here came from main rather than from this branch, and
  deliberately. This branch still carried the old fourteen-item inventory,
  where "Psychology template & scoring" and "NOVA Score" were the same
  promise twice and "Performance analytics", "Trading calendar" and
  "Searchable trade log" were three names for looking at your own trades.
  Main had already cut that to six outcomes, on research putting the useful
  range at five to seven bullets and a documented case going from 1.2% to
  3.1% conversion by shortening the list. Winning a merge is not a reason to
  lose that.
*/
const IN_EVERY_PLAN = [
  'Talk through a trade \u2014 it writes itself up',
  'Nova reads every entry and tells you what you keep doing',
  'Your psychology scored on every trade, not just P&L',
  'Your own rules and checklists, checked before you enter',
  'Calendar, analytics and every trade searchable',
  'Weekly and monthly reviews, written for you',
];

/* The specifics a comparison shopper checks, kept but not shouted. */
const ALSO_INCLUDED =
  'Unlimited trades \u00b7 CSV import \u00b7 Notes \u00b7 14-day money back guarantee';

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
        tier.featured
          ? 'border-brand-blue-light/40 bg-brand-blue/[0.06]'
          : 'border-white/10 bg-brand-surface'
      }`}
    >
      {tier.featured && (
        <span
          className="absolute -top-2.5 left-6 rounded-full bg-brand-blue-light px-2.5 py-1
            text-[10px] font-medium uppercase tracking-[0.12em] text-black"
        >
          Most popular
        </span>
      )}
      <p className="text-[13px] uppercase tracking-[0.14em] text-gray-400">{tier.name}</p>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[42px] leading-none font-semibold text-white tracking-[-0.035em] tabular-nums">
          {tier.price}
        </span>
        <span className="text-[14px] text-gray-500">/month</span>
      </p>

      <p className="mt-3 text-[13px] leading-relaxed text-gray-400">{tier.who}</p>

      <ul className="mt-6 mb-7 flex flex-col gap-2.5">
        {tier.lines.map((line) => (
          <li key={line.text} className="flex gap-2.5 text-[13.5px] leading-relaxed">
            {/*
              A dash rather than a cross for what a tier does not include.
              A red X reads as a fault; this is simply a thing that lives one
              tier up, and the row is greyed rather than struck through.
            */}
            {line.included ? (
              <Check className="mt-[3px] w-3.5 h-3.5 flex-shrink-0 text-brand-blue-light" strokeWidth={2.5} />
            ) : (
              <Minus className="mt-[3px] w-3.5 h-3.5 flex-shrink-0 text-gray-600" strokeWidth={2.5} />
            )}
            <span className={line.included ? 'text-gray-300' : 'text-gray-600'}>{line.text}</span>
          </li>
        ))}
      </ul>

      {/* mt-auto so three cards of unequal copy still line their buttons up. */}
      <Link
        to="/auth?mode=signup"
        className={`mt-auto w-full inline-flex items-center justify-center px-6 py-3 rounded-full
          text-[14px] font-medium transition-colors ${
            tier.featured
              ? 'bg-white text-black hover:bg-gray-200'
              : 'border border-white/15 text-white hover:bg-white/5'
          }`}
      >
        {tier.cta}
      </Link>
    </div>
  );
}

export default function Pricing() {
  return (
    <PageShell
      width="wide"
      eyebrow="Pricing"
      title="Pick how many accounts you run."
      subtitle="Every plan has the whole product in it. What changes is how many accounts sync, and how fast."
    >
      <div className="grid gap-5 md:grid-cols-3 md:gap-4 lg:gap-5 items-stretch">
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      {/*
        Platforms are listed apart from the tiers on purpose, and the tiers
        promise "connected accounts" rather than naming any platform.

        A tier that says "3 MT4/MT5 accounts" has to be re-written the week
        cTrader ships. One that says "3 connected accounts" does not, and this
        line underneath can be edited freely without touching a price or a
        promise. Nothing goes on this list until an account has actually
        synced through it.
      */}
      <p className="mt-7 text-center text-[12.5px] text-gray-500">
        Connect MetaTrader 4 and MetaTrader 5 today. More platforms are being added
        — <Link to="/faq" className="text-gray-400 underline underline-offset-2 hover:text-white">see what is supported</Link>.
      </p>

      <div className="mt-12 sm:mt-14 rounded-2xl border border-white/10 bg-brand-surface p-6 sm:p-8">
        <p className="text-[13px] uppercase tracking-[0.14em] text-gray-400 mb-5">
          In every plan
        </p>
        <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {IN_EVERY_PLAN.map((item) => (
            <li key={item} className="flex gap-2.5 text-[13.5px] text-gray-300 leading-relaxed">
              <Check className="mt-[3px] w-3.5 h-3.5 flex-shrink-0 text-brand-blue-light" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>
        {/* The specifics a comparison shopper looks for, kept but not shouted. */}
        <p className="mt-5 text-[12px] text-gray-500 leading-relaxed">
          {ALSO_INCLUDED}
        </p>
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

      <Section
        title="Getting started takes about a minute"
        lead="You can connect an account, or never connect one at all."
      >
        <Steps
          items={[
            {
              title: 'Make an account',
              body: 'Email and a password. No broker credentials needed to start, and no card details beyond the subscription itself.',
            },
            {
              title: 'Get your trades in',
              body: 'Connect a MetaTrader account and your closed trades arrive on their own. Or upload the CSV your broker exports, or just talk through trades as you take them.',
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
              q: 'What counts as a connected account?',
              a: 'A live trading account that syncs itself — you connect it once and closed trades arrive without you doing anything. Accounts you add by hand or import from a CSV do not count against that number, and they are unlimited on every plan.',
            },
            {
              q: 'What is the difference between daily and live sync?',
              a: 'On Starter, closed trades are collected once a day. On Pro and Elite they arrive within a few minutes of the position closing, so you can write the trade up while you still remember what you were thinking. Nothing is lost either way — it is a question of when it lands, not whether.',
            },
            {
              q: 'I am already a member. Does this change my price?',
              a: 'No. The rate you joined at is the rate you keep, and nothing you already have access to is being moved behind a higher tier. These plans are for new members.',
            },
            {
              q: 'What if I need more than six accounts?',
              a: 'Add them to Pro or Elite for $15 a month each. That is close to what a hosted account costs us, so there is no volume penalty hiding in it.',
            },
            {
              q: 'Is there a free trial?',
              a: 'There is a 14-day money back guarantee instead, which does the same job without the part where a card gets charged on a day you forgot about. Give it two proper weeks. If you are still not journaling, or it has not shown you something about how you trade that you did not already know, ask for your money back.',
            },
            {
              q: 'How do I cancel?',
              a: 'Two clicks in Settings. No email to send, no retention call, no "are you sure" chain. You keep access until the period you paid for ends.',
            },
            {
              q: 'Can I change plan later?',
              a: 'Yes, either direction, from Settings. Moving up takes effect immediately; moving down takes effect at the end of the period you have already paid for.',
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
