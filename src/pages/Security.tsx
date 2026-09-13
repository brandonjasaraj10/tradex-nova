import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { Section, Card, CardGrid, QA, ClosingCta } from '../components/marketing/blocks';

/*
  The page that answers "is my money safe".

  Written to one rule: everything on it is true today. There are no compliance
  badges here - no SOC 2, no "GDPR certified", no ISO seal - because TradeX
  holds none of those, and a security page is the single worst place on a
  website to overstate something. A trader who later discovers the badge was
  decoration has learned exactly the wrong thing about a product they trusted
  with their trading history.

  What it does instead is describe the actual architecture in plain words,
  which for this audience is more convincing than a seal anyway: the whole
  objection is "can TradeX touch my account", and the answer is a structural
  no rather than a promise.
*/

export default function Security() {
  return (
    <PageShell
      eyebrow="Security"
      title="TradeX can never place a trade"
      subtitle="Not by policy, by design. Here is exactly what it can reach, what it stores, and what it is structurally incapable of doing."
    >
      <Section
        title="Your account is not connected to TradeX"
        lead="The thing people actually worry about, answered first."
      >
        <CardGrid>
          <Card title="No trading permissions, ever" accent>
            TradeX has no ability to place, close or modify an order. It never asks
            for the kind of access that would allow it, so there is nothing to
            revoke and nothing to misuse.
          </Card>
          <Card title="No withdrawal access">
            Your broker password and your money stay with your broker. TradeX
            never holds funds, never moves them, and has no payout path of any
            kind.
          </Card>
          <Card title="CSV import today">
            Right now your trades reach TradeX either by typing them or by
            uploading the statement your broker exports. A file you chose to
            upload cannot grant access to anything.
          </Card>
          <Card title="Read-only sync when it ships">
            MT4 and MT5 sync lands in the next couple of weeks. It is read-only:
            TradeX will see closed trade history and account balance, and nothing
            else. That is the only access it will ever request.
          </Card>
        </CardGrid>
      </Section>

      <Section
        title="Your data is separated at the database, not in the interface"
        lead="A screen that declines to show you someone else's trades is not the same thing as a database that refuses to hand them over."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="Row-level security on every table">
            Every table holding user data carries a policy tying each row to the
            account that owns it. The check runs inside the database, so it
            applies to the app, the API and anything else that ever queries it.
          </Card>
          <Card title="Tested with two real accounts, not by reading the code">
            Before launch, one account created records across every distinct
            access pattern in the app, and a second account then tried to read,
            update and delete each of them using its own real credentials
            against the raw API. Every attempt was refused, and the first
            account&rsquo;s data was confirmed byte-for-byte unchanged afterwards.
          </Card>
          <Card title="Encrypted in transit and at rest">
            Traffic runs over HTTPS with HSTS. Stored data is encrypted at rest
            by the database provider.
          </Card>
        </div>
      </Section>

      <Section
        title="Your card never reaches us"
        lead="Payments run through Stripe end to end."
      >
        <Card>
          Card numbers are entered on Stripe&rsquo;s own payment form and go straight
          to Stripe. TradeX never sees them, never receives them and stores
          nothing beyond the fact that a subscription is active. Cancelling is
          two clicks in Settings &mdash; no email, no retention call.
        </Card>
      </Section>

      <Section
        title="What Nova does and does not do with what you write"
        lead="Nova is built on Claude, Anthropic's AI. This is the part most journals are vague about, so here it is plainly."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="Your entries are sent to Anthropic to answer your questions">
            That is how Nova reads your trading history at all. Anthropic does not
            train its models on data sent through its API.
          </Card>
          <Card title="Nobody else sees your entries">
            Your journal, your psychology scores and your conversations with Nova
            are not shown to other users and are not sold to anyone.
          </Card>
          <Card title="You can take it all with you, or delete it">
            Export or delete everything from Settings. Deleting your account
            removes your data rather than deactivating it.
          </Card>
        </div>
      </Section>

      <Section title="Straight answers">
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
        title="Nothing to connect, nothing to risk"
        body="Start with a CSV or type a trade. Your broker never hears about it."
      />
    </PageShell>
  );
}
