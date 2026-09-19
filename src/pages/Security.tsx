import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { Split, Section, QA, ClosingCta } from '../components/marketing/blocks';
import { PullQuote, PermissionsPanel, ImportPathsPanel, Frame } from '../components/marketing/product';

/*
  The page that answers "is my money safe".

  Written to one rule: everything on it is true today. There are no compliance
  badges here - no SOC 2, no "GDPR certified", no ISO seal - because TradeX
  holds none of those, and a security page is the single worst place on a
  website to overstate something. A trader who later discovers the badge was
  decoration has learned exactly the wrong thing about a product they trusted
  with their trading history.

  What it does instead is show the architecture rather than describe it. The
  permissions table at the top is the whole argument in one glance - six rows,
  two of them read-only and four of them never - and it answers the actual
  objection faster than the four paragraphs it replaced.
*/

export default function Security() {
  return (
    <PageShell
      width="wide"
      eyebrow="Security"
      title="TradeX can never place a trade"
      subtitle="Not by policy — by design. Here is exactly what it can reach, what it stores, and what it is structurally incapable of doing."
    >
      <PermissionsPanel />

      <Split
        eyebrow="Your broker"
        title="Your account is not connected to TradeX"
        lead="The thing people actually worry about, answered first and without hedging."
        points={[
          'No trading permissions, ever — there is nothing to revoke',
          'No withdrawal access. TradeX never holds or moves funds',
          'Your trades arrive by MT4/MT5 sync, by CSV, or by you typing them',
          'Sync is read-only: closed trades and balance, nothing else',
        ]}
        visual={<ImportPathsPanel />}
      />

      <PullQuote>
        A screen that declines to show you someone else&rsquo;s trades is not the same
        thing as a database that refuses to hand them over.
      </PullQuote>

      <Split
        flip
        eyebrow="Isolation"
        title="Your data is separated at the database, not in the interface"
        lead="Every table holding user data carries a policy tying each row to the account that owns it. The check runs inside the database, so it applies to the app, the API, and anything else that ever queries it."
        points={[
          'Row-level security on every table that holds user data',
          'Tested with two real accounts against the raw API, not by reading the code',
          'Every cross-account read, update and delete was refused',
          'Encrypted in transit over HTTPS, and at rest by the database provider',
        ]}
        visual={
          <Frame label="Two-account isolation test" note="Run before launch">
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {[
                'Read account A’s journal entries',
                'Read account A’s trades by row ID',
                'Update account A’s psychology scores',
                'Delete account A’s Nova conversations',
                'List account A’s trading rules',
              ].map((attempt) => (
                <div key={attempt} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-[12.5px] text-gray-400">{attempt}</span>
                  <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-[0.1em]
                    text-gray-500 border border-white/10 rounded-full px-2.5 py-1">
                    Blocked
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-gray-600">
              Attempted as account B using its own real credentials, then account
              A&rsquo;s data was checked in the database and confirmed unchanged.
            </p>
          </Frame>
        }
      />

      <Split
        eyebrow="Payments"
        title="Your card never reaches us"
        lead="Payments run through Stripe end to end. Card numbers are entered on Stripe’s own form and go straight to Stripe."
        points={[
          'TradeX never sees, receives or stores a card number',
          'All we keep is whether a subscription is active',
          'Cancel in two clicks from Settings — no email, no retention call',
        ]}
        visual={
          <Frame label="What we store about your payment" note={null}>
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {[
                ['Card number', false],
                ['CVV / expiry', false],
                ['Billing address', false],
                ['Subscription is active', true],
                ['Renewal date', true],
              ].map(([label, stored]) => (
                <div key={label as string} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={`text-[13px] ${stored ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
                  <span className={`flex-shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] rounded-full px-2.5 py-1
                    ${stored
                      ? 'text-brand-blue-light bg-brand-blue-light/10'
                      : 'text-gray-500 border border-white/10'}`}>
                    {stored ? 'Stored' : 'Never stored'}
                  </span>
                </div>
              ))}
            </div>
          </Frame>
        }
      />

      <Split
        flip
        eyebrow="Nova and your entries"
        title="What the AI does and does not do with what you write"
        lead="Nova is built on Claude, from Anthropic. This is the part most journals are vague about, so here it is plainly."
        points={[
          'Your entries are sent to Anthropic so Nova can read them and answer you',
          'Anthropic does not train its models on data sent through its API',
          'Your entries are not shown to other users and are not sold to anyone',
          'Export or delete everything from Settings — deleting removes rather than deactivates',
        ]}
        visual={
          <Frame label="Where your journal goes" note={null}>
            <div className="flex flex-col gap-2.5">
              {[
                { k: 'Your browser', v: 'Where you write it' },
                { k: 'TradeX database', v: 'Stored against your account only, encrypted at rest' },
                { k: 'Anthropic (Claude)', v: 'Sent when you ask Nova a question, so it can answer' },
              ].map((s, i) => (
                <div key={s.k} className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="w-6 h-6 rounded-full border border-white/10 bg-brand-elevated
                      flex items-center justify-center text-[10px] text-gray-500 tabular-nums">{i + 1}</span>
                    {i < 2 && <span className="w-px flex-1 bg-white/[0.08] my-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-[13px] font-medium text-white">{s.k}</p>
                    <p className="text-[12px] leading-relaxed text-gray-500 mt-0.5">{s.v}</p>
                  </div>
                </div>
              ))}
              <div className="mt-1 rounded-xl border border-white/[0.07] bg-brand-elevated px-3.5 py-2.5">
                <p className="text-[12px] leading-relaxed text-gray-500">
                  Nowhere else. No advertisers, no brokers, no prop firms, no data buyers.
                </p>
              </div>
            </div>
          </Frame>
        }
      />

      <Section title="Straight answers, including the uncomfortable ones">
        <QA
          items={[
            {
              q: 'Do you have SOC 2 or ISO certification?',
              a: 'No, and we are not going to put a badge on this page pretending otherwise. TradeX is a small, young product. What we can tell you is exactly how it is built, which is what the rest of this page does.',
            },
            {
              q: 'Could a TradeX employee read my journal?',
              a: 'Database administration access exists, as it does for every product that stores anything. It is used for operating the service, not for reading entries. We are not going to claim a technical impossibility that is not true.',
            },
            {
              q: 'What happens to my data if I cancel?',
              a: 'It stays until you delete it, so that resubscribing picks up where you left off. Delete your account from Settings and it goes.',
            },
            {
              q: 'Do you sell or share my trading data?',
              a: 'No. Not to brokers, not to prop firms, not to advertisers. There is no arrangement of that kind and there is not going to be one.',
            },
            {
              q: 'Does my prop firm see any of this?',
              a: 'No. TradeX has no arrangement with any prop firm and does not share data with one.',
            },
          ]}
        />
      </Section>

      <p className="mt-10 text-[13px] text-gray-500 leading-relaxed">
        Found something that looks wrong? Email{' '}
        <a
          href="mailto:tradenovaai@gmail.com"
          className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
        >
          tradenovaai@gmail.com
        </a>{' '}
        and we will look at it properly. The full detail is in the{' '}
        <Link to="/privacy" className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors">
          Privacy Policy
        </Link>
        .
      </p>

      <ClosingCta
        title="Read-only, or nothing at all"
        body="Sync your account read-only, import a CSV, or just type the trade. TradeX can never place an order or move a dollar."
      />
    </PageShell>
  );
}
