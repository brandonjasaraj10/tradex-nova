import PageShell from '../components/layout/PageShell';
import { Section, Card, QA, ClosingCta } from '../components/marketing/blocks';
import ProductShot from '../components/sales/ProductShot';
import { WORKS_TODAY, NOT_YET } from '../lib/integrations';

/*
  The integrations page.

  WHY IT EXISTS

  Both competitors carry one in their top navigation - TradeZella as
  "Supported brokers", Tradespad as "Integrations" - and that is not a
  coincidence. For a trading journal, "will this work with my account?" is
  the first practical question anybody asks, and until now TradeX answered it
  with a scrolling marquee in the hero and one line of FAQ.

  THE ONE THING THIS PAGE MUST NOT DO

  Overclaim. The temptation is to list every name a visitor might recognise,
  and the firms people recognise most in 2026 are futures prop firms -
  TopStep, Apex, Bulenox - none of which are on MetaTrader at all. Listing
  them here because the names are familiar would be exactly the kind of claim
  that has been coming off this site all week.

  So the page is organised around the only thing that actually decides it:
  which platform your account runs on. Names that work sit under MetaTrader.
  Names that do not sit under "not yet", with the platform they use named, so
  a futures trader gets a straight answer rather than a missing one.

  See lib/integrations.ts for why the list is hand-written rather than
  generated from the brokers table.
*/

export default function Integrations() {
  const props = WORKS_TODAY.filter((f) => f.kind === 'prop');
  const brokers = WORKS_TODAY.filter((f) => f.kind === 'broker');

  return (
    <PageShell
      width="wide"
      eyebrow="Integrations"
      title="If your account runs on MetaTrader, it works"
      subtitle="TradeX connects through MetaTrader itself rather than through any firm — so your broker, your prop firm, or both at once all work the same way."
    >
      {/*
        The two platforms, stated as the claim. Set in our own type rather
        than MetaQuotes' marks: there is no licence to use their logos, and
        the real wordmarks are a mid-2000s gradient that would look like a
        foreign object on this page.
      */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { short: 'MT4', long: 'MetaTrader 4' },
          { short: 'MT5', long: 'MetaTrader 5' },
        ].map((p) => (
          <div
            key={p.short}
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent
              p-6 sm:p-8 text-center"
          >
            <p className="text-[30px] sm:text-[38px] font-semibold tracking-[-0.03em] text-white">
              {p.short}
            </p>
            <p className="mt-1.5 text-[12.5px] text-gray-500">{p.long}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full
              border border-brand-blue/25 bg-brand-blue/[0.06] px-2.5 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="motion-reduce:hidden absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-blue" />
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-brand-blue">Live</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          ['Read-only', 'It can never place, close or modify a trade, and it never touches your money.'],
          ['Minutes, not days', 'Closed trades arrive on their own, usually within a few minutes.'],
          ['Your whole history', 'Everything already on the account comes across when you connect it.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5">
            <p className="text-[13.5px] font-medium text-white">{title}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">{body}</p>
          </div>
        ))}
      </div>

      <Section
        title="Firms and brokers that work today"
        lead="Not partnerships — there is no arrangement with any of these. Their accounts simply run on a platform TradeX can read."
      >
        <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600">Prop firms</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {props.map((f) => (
            <li
              key={f.name}
              className="rounded-lg border border-white/[0.08] bg-brand-surface px-3 py-1.5 text-[13px] text-gray-300"
            >
              {f.name}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[10px] tracking-[0.16em] uppercase text-gray-600">Brokers</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {brokers.map((f) => (
            <li
              key={f.name}
              className="rounded-lg border border-white/[0.08] bg-brand-surface px-3 py-1.5 text-[13px] text-gray-300"
            >
              {f.name}
            </li>
          ))}
        </ul>

        <p className="mt-7 text-[13.5px] leading-relaxed text-gray-400">
          This is not a whitelist. If your firm hands you an MT4 or MT5 login,
          it works &mdash; whether it is on this list or not. The list is here
          because recognising a name is faster than reading a sentence about
          platforms.
        </p>
      </Section>

      <Section
        title="Not yet"
        lead="Named honestly, with no dates on them. Nothing here is committed."
      >
        <div className="flex flex-col gap-3">
          {NOT_YET.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5
                sm:flex sm:items-baseline sm:gap-6"
            >
              <p className="text-[14px] font-medium text-white sm:w-[230px] sm:flex-shrink-0">
                {item.name}
              </p>
              <p className="mt-1.5 sm:mt-0 text-[13px] leading-relaxed text-gray-500">{item.who}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[13.5px] leading-relaxed text-gray-400">
          If you trade futures, be straight with yourself about this one:
          TopStep, Apex, Bulenox and Tradeify are not on MetaTrader, so sync
          will not work today. You can still import a statement or add trades
          by hand, and everything else in TradeX &mdash; Nova, the psychology
          scoring, the calendar &mdash; works exactly the same either way.
        </p>
      </Section>

      <Section
        title="No account to connect yet?"
        lead="Sync is the fastest way in, not the only one."
      >
        <Card>
          Upload the statement your platform exports, or add trades by hand.
          Both put the same rows in the same journal, and the psychology side
          of TradeX never needed the connection in the first place &mdash; it
          runs on what you write, not on what your broker reports.
        </Card>

        <figure className="mt-7">
          <ProductShot
            src="/product/journal.jpg"
            label="Journal"
            alt="A synced trade shown inside its journal entry: symbol, direction, size and duration filled in, with the written review and the psychology checklist alongside."
          />
          <figcaption className="mt-3 text-[12.5px] text-gray-500">
            A synced trade, with the part only you can add.
          </figcaption>
        </figure>
      </Section>

      <Section title="The questions people ask about connecting">
        <QA
          items={[
            {
              q: 'Does connecting break my prop firm’s rules?',
              a: 'No. TradeX never places, closes or modifies a trade, and the connection is read-only — it can only see history. No prop firm has a rule against keeping a journal.',
            },
            {
              q: 'What exactly can TradeX see?',
              a: 'Your trade history and your balance. Not your password, not your funds, and nothing it could act on. The connection uses an investor password, which is read-only by design and is never stored.',
            },
            {
              q: 'My firm is not on the list. Will it work?',
              a: 'Almost certainly, if they gave you an MT4 or MT5 login. The connection is to MetaTrader, not to the firm, so the firm does not have to know anything about TradeX for it to work.',
            },
            {
              q: 'How many accounts can I connect?',
              a: 'One on Starter, two on Pro, five on Elite — synced at the same time. You can add more by hand or by statement import on any plan.',
            },
            {
              q: 'How fast do trades show up?',
              a: 'Usually within a few minutes of the position closing. Everything already on the account arrives the moment you connect it.',
            },
          ]}
        />
      </Section>

      <ClosingCta
        title="Connect the account once"
        body="Then the only thing left to add is what you were thinking."
      />
    </PageShell>
  );
}
