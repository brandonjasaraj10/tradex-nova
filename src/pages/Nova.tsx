import PageShell from '../components/layout/PageShell';
import NovaAnswer from '../components/sales/NovaAnswer';
import { Section, Card, CardGrid, QA, ClosingCta } from '../components/marketing/blocks';

/*
  Nova's own page.

  Nova is the thing the established journals do not have, and on the landing
  page it gets one section competing with eleven others. A trader comparing
  TradeX against a journal they already own is comparing this, specifically -
  so it needs somewhere it is the only subject.

  The live demo is the same component the landing page uses rather than a
  screenshot: it is the claim, happening.
*/

export default function Nova() {
  return (
    <PageShell
      eyebrow="Nova"
      title="The part that reads your journal back to you"
      subtitle="Writing entries is work. Nova is the reason the work pays off — it reads every entry together and tells you what you keep doing."
    >
      {/*
        The question has to be here, not just the answer. NovaAnswer renders
        only Nova's reply - on the landing page the question that prompted it
        sits in the surrounding copy. Dropped in on its own it read as an
        answer to nothing.
      */}
      <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7 mb-3">
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
              px-4 py-2.5 text-[13px] sm:text-sm text-gray-300">
              Why am I losing on Fridays?
            </p>
          </div>
          <NovaAnswer />
        </div>
      </div>
      <p className="text-[11px] text-gray-600 mb-2">Example conversation</p>

      <Section
        title="It has actually read your trades"
        lead="Not a chatbot bolted onto a journal. Nova queries your real history to answer."
      >
        <CardGrid>
          <Card title="Ask in plain language" accent>
            &ldquo;What is my worst habit?&rdquo; &ldquo;Am I better in the
            morning?&rdquo; &ldquo;Why did last week go wrong?&rdquo; No filters to
            configure, no report to build first.
          </Card>
          <Card title="It pulls the numbers itself">
            Nova runs the analysis against your trades rather than guessing, so
            the answer comes back with your actual figures in it.
          </Card>
          <Card title="It can log the trade for you">
            Tell Nova what happened and it writes the journal entry, then
            confirms what it recorded.
          </Card>
          <Card title="It reads psychology, not just P&L">
            Your mood, focus and pre-trade state are part of what it looks at,
            which is how a pattern like &ldquo;you break your rules on Mondays&rdquo;
            surfaces at all.
          </Card>
        </CardGrid>
      </Section>

      <Section
        title="It remembers you between conversations"
        lead="The thing that makes most AI assistants exhausting is re-explaining yourself every time."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="Cross-session memory" accent>
            Tell Nova something once &mdash; a recurring problem, a rule you are
            working on, what you are trying to fix this month &mdash; and it is
            still there in a conversation you start next week.
          </Card>
          <Card title="It knows how you trade">
            Set your goals, risk tolerance and trading style once, and every
            answer is framed against them. Advice for a scalper on a funded
            account is not advice for a swing trader on personal capital.
          </Card>
          <Card title="Tell it when it is wrong">
            Rate any answer up or down. Those ratings are read and used to sharpen
            how Nova responds.
          </Card>
        </div>
      </Section>

      <Section title="What Nova is, underneath">
        <QA
          items={[
            {
              q: 'Which AI is it?',
              a: 'Claude, from Anthropic. Nova is the trading-specific system built on top of it — the part that knows your history, your rules and your psychology, and knows how to query them.',
            },
            {
              q: 'Is my journal used to train an AI model?',
              a: 'No. Your entries are sent to Anthropic so Nova can read them and answer you. Anthropic does not train its models on data sent through its API.',
            },
            {
              q: 'Can it tell me what to trade?',
              a: 'No, and it will not pretend to. Nova analyses trades you have already taken. TradeX is a journal, not an advisory service, and it does not give trading recommendations.',
            },
            {
              q: 'Will it just tell me what I want to hear?',
              a: 'It is built to do the opposite. The whole reason to have it is the pattern you cannot see from inside your own trading, and a version that flattered you would be worth nothing.',
            },
            {
              q: 'Is there a limit on how much I can ask it?',
              a: 'There is a fair-use cap to stop abuse. Normal use does not come near it.',
            },
          ]}
        />
      </Section>

      <ClosingCta
        title="Ask it something about your trading"
        body="Import a CSV and Nova has something to read within a minute."
      />
    </PageShell>
  );
}
