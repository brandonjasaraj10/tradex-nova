import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import { Section, QA, Steps, ClosingCta } from '../components/marketing/blocks';
import { PullQuote, StatBand } from '../components/marketing/product';
import Mascot from '../components/shared/Mascot';
import { TIERS, IN_EVERY_PLAN, ALSO_INCLUDED, type Tier } from '../lib/pricingTiers';

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
      subtitle="Every plan has the whole product in it. What changes is how many accounts sync themselves."
    >
      {/*
        He belongs on this page and NOT on the paywall, and the distinction is
        not taste.

        The guidance on mascots in product is specific about this one screen:
        a character that becomes the face of a paywall gets resented, and the
        exception is when the upgrade is tied to positive progress - more
        seats, more exports, more of something the reader already wants. This
        page is exactly that exception: nobody is blocked here, they are
        choosing how many accounts to sync. Payment.tsx is the other case - a
        signed-up trader who cannot get in - so he stays off it.

        Presenting, because the three cards are what he is presenting, and
        above them rather than beside a price, so he introduces the choice
        instead of selling one of the options.
      */}
      <Mascot pose="present" height={96} className="mx-auto mb-8 sm:mb-10" />

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
              q: 'I am already a member. Does this change my price?',
              a: 'No. The rate you joined at is the rate you keep, and nothing you already have access to is being moved behind a higher tier. These plans are for new members.',
            },
            {
              q: 'What if I need more accounts than my plan covers?',
              a: 'Move up a plan from Settings and it takes effect immediately. If none of the three covers what you run, email tradenovaai@gmail.com and we will sort it out \u2014 there are few enough people in that position that it is worth doing by hand rather than guessing at a tier for it.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Three days, free. Your card is authorised for the plan price and released straight away \u2014 nothing is taken \u2014 so if the card will not work you find out on day one instead of day three. Syncing is the one thing a trial does not include: that is what subscribing turns on, and you can subscribe the moment you want it rather than waiting the three days out. The 14-day money back guarantee applies after that as well.',
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
