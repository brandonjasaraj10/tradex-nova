import PageShell from '../components/layout/PageShell';
import { Section, Card, CardGrid, QA, ClosingCta } from '../components/marketing/blocks';

/*
  The ICP page.

  Prop challenge traders are the sharpest segment TradeX has: a large, clearly
  defined group with one specific, expensive, recurring failure - blowing an
  account on a rule they already knew - and a reason to care about psychology
  that does not need explaining to them.

  This is a landing page, not a feature list. The job is to name the failure
  precisely enough that a reader recognises their own last blown challenge in
  it, then show the part of the product that addresses that specific failure.
  Nothing here claims TradeX passes challenges for anybody.

  Deliberately no invented statistics. The figures thrown around about prop
  firm pass rates come from firms marketing to traders and are not verifiable,
  so the page argues from the reader's own experience instead, which is more
  persuasive and cannot be wrong.
*/

export default function PropFirmTraders() {
  return (
    <PageShell
      eyebrow="For prop firm traders"
      title="You did not fail the challenge on strategy"
      subtitle="You failed it on a rule you already knew. TradeX is built around the part of trading that actually costs you the account."
    >
      <Section
        title="The way a challenge really ends"
        lead="Almost never a bad system. Almost always a bad twenty minutes."
      >
        <CardGrid>
          <Card title="Revenge after a loss">
            The setup was fine. The trade after it was not, and it was twice the
            size.
          </Card>
          <Card title="Moving the stop">
            You knew where the invalidation was when you entered. You moved it
            anyway, and then again.
          </Card>
          <Card title="Trading the daily drawdown limit">
            Down for the day, and suddenly the position that gets it back is the
            one that ends the account.
          </Card>
          <Card title="The last day of the month">
            Close to target, so the rules loosen — exactly when they should not.
          </Card>
        </CardGrid>
        <p className="mt-6 text-[14px] leading-relaxed text-gray-400">
          You can already name which of these is yours. What you cannot do,
          from inside it, is see how often it happens &mdash; and that is the
          entire difference between knowing about a habit and actually
          breaking one.
        </p>
      </Section>

      <Section
        title="What TradeX does about it"
        lead="Four things, each aimed at a specific way challenges end."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="It records your state, not just your entries" accent>
            Mood, focus and your pre-trade intention, captured at the time. So
            when Nova says you break your rules after a losing morning, that is
            a fact about your own recorded data rather than a guess.
          </Card>
          <Card title="Your rules, ticked before you enter">
            A pre-trade checklist you wrote yourself, in front of you at the
            moment it matters, instead of a rule you only judge afterwards.
          </Card>
          <Card title="It counts what you would rather not count">
            &ldquo;You moved your stop on four of your last six losers&rdquo; is the
            kind of sentence that changes behaviour. It is also the kind nobody
            arrives at by scrolling their own trade history.
          </Card>
          <Card title="Thirty seconds a trade, so you keep doing it">
            A journal you abandon in week three teaches you nothing. Talk for
            half a minute and the entry writes itself &mdash; which is the only
            reason the habit survives a bad week.
          </Card>
        </div>
      </Section>

      <Section
        title="Built for running several accounts"
        lead="Challenge, funded and personal are three different traders wearing your name."
      >
        <Card>
          Up to five accounts, each with its own trades, balance, analytics and
          NOVA Score. Metrics follow whichever account you are looking at, so a
          funded account&rsquo;s discipline is never quietly averaged in with the
          demo you are messing about on.
        </Card>
      </Section>

      <Section title="The questions prop traders ask">
        <QA
          items={[
            {
              q: 'Will TradeX break my prop firm’s rules?',
              a: 'It cannot. TradeX never places, closes or modifies a trade, and never connects to your account in a way that would let it. It is a journal — no prop firm has a rule against keeping one.',
            },
            {
              q: 'Does my prop firm see any of this?',
              a: 'No. Your journal is yours. TradeX has no arrangement with any prop firm and does not share data with one.',
            },
            {
              q: 'Can I import from my challenge account?',
              a: 'Yes — upload the statement your platform exports. Direct MT4 and MT5 sync lands in the next couple of weeks, and it is read-only when it does.',
            },
            {
              q: 'I am on my fourth challenge. Is this going to help?',
              a: 'Honestly, that depends on whether the same thing has ended all four. If it has, that is exactly the pattern TradeX is built to make visible. If your problem is genuinely strategy, a journal will show you that too — it just will not be the answer you were hoping for.',
            },
            {
              q: 'Does it work with futures and forex?',
              a: 'Yes. You log the instrument you actually trade; nothing here is tied to one market.',
            },
          ]}
        />
      </Section>

      <ClosingCta
        title="Find out what ends your challenges"
        body="Import your last one and see what TradeX finds in it."
      />
    </PageShell>
  );
}
