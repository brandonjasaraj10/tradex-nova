import PageShell from '../components/layout/PageShell';
import { Link } from 'react-router-dom';
import { Section, QA, ClosingCta } from '../components/marketing/blocks';

/*
  Every objection in one place.

  The landing page carries six questions, which is as many as a landing page
  should. This is where the rest live - the ones that would bloat that page
  but that somebody genuinely stalls on. Grouped, because a flat list of
  twenty is not a page anybody reads.

  The six that appear on the landing page are repeated here on purpose: a
  visitor who arrives on this page from search has not read that one, and
  sending them elsewhere for the most common answers would be perverse.
*/

export default function FAQ() {
  return (
    <PageShell
      eyebrow="Questions"
      title="The honest answers"
      subtitle="Including the ones where the answer is “no”."
    >
      <Section title="Does this actually work?">
        <QA
          items={[
            {
              q: 'Does journaling actually work?',
              a: 'Only if you keep doing it. That is the whole problem, and it is what TradeX is built around — a journal you abandon in week three teaches you nothing, however good its charts are. Thirty seconds of talking is a habit people keep.',
            },
            {
              q: 'I have tried journals before and quit. Why is this different?',
              a: 'Two reasons. The quitting is the problem we built around — journals do not fail on features, they fail at 4pm when typing up a trade is the last thing you want to do. And every other journal shows you your P&L. TradeX records how you felt going in and matches it against what happened, because seeing that you lost and seeing why you lost are different things.',
            },
            {
              q: 'How is this different from a spreadsheet?',
              a: 'You stop typing. You talk through the trade and TradeX writes the entry, then reads every entry together and tells you what you keep doing — which a spreadsheet has never once done for anybody.',
            },
            {
              q: 'Will it make me profitable?',
              a: 'No, and anyone telling you otherwise is selling something. It shows you what you repeatedly do wrong. Acting on that is still your job.',
            },
          ]}
        />
      </Section>

      <Section title="Getting your trades in">
        <QA
          items={[
            {
              q: 'Can I connect my broker?',
              a: 'Right now you import a CSV from your broker or add trades as you go. Direct MT4 and MT5 sync lands in the next couple of weeks, and it is read-only when it does — TradeX will see your trade history and nothing else. It can never place, close or modify a trade, and it never touches your money.',
            },
            {
              q: 'Which markets does it handle?',
              a: 'Forex, futures, stocks, crypto — you log the instrument you trade. Nothing here is tied to one market.',
            },
            {
              q: 'Can I track more than one account?',
              a: 'Up to five, each with its own trades, balance and analytics, and a selector to switch between them.',
            },
            {
              q: 'Is there a limit on how many trades I can log?',
              a: 'No. Unlimited, on the one plan.',
            },
          ]}
        />
      </Section>

      <Section title="Voice and Nova">
        <QA
          items={[
            {
              q: 'Do I have to use voice?',
              a: 'No. It is the fast path, not the only one — the full entry form is there whenever you would rather type.',
            },
            {
              q: 'Does it understand trading terms?',
              a: 'Yes. Say you shorted euro dollar half a lot and got stopped for a hundred and eighty and it files EURUSD, short, 0.5 lots, −$180 in the right fields.',
            },
            {
              q: 'What if it gets the entry wrong?',
              a: 'Edit it. Nothing is locked — what Nova writes is a draft it saved you typing, not a verdict.',
            },
            {
              q: 'Can Nova tell me what to trade?',
              a: 'No. TradeX is a journal, not an advisory service. Nova analyses trades you have already taken and does not give trading recommendations.',
            },
          ]}
        />
      </Section>

      <Section title="Privacy and safety">
        <QA
          items={[
            {
              q: 'Who can see what I write?',
              a: 'Only you. Your entries, your psychology scores and your conversations with Nova are yours — they are not shown to other users and they are not sold to anyone. You can export or delete everything from Settings.',
            },
            {
              q: 'Can TradeX touch my trading account?',
              a: 'No, structurally. It never asks for the kind of access that would let it place, close or modify an order, so there is nothing to revoke and nothing to misuse.',
            },
            {
              q: 'Is my card safe?',
              a: 'Payments run through Stripe end to end. Card numbers go straight to Stripe and never reach TradeX.',
            },
          ]}
        />
        <p className="mt-6 text-[13.5px] text-gray-400">
          The full detail is on the{' '}
          <Link to="/security" className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors">
            security page
          </Link>
          .
        </p>
      </Section>

      <Section title="Paying, and stopping">
        <QA
          items={[
            {
              q: 'What if it is not for me?',
              a: '14-day money back guarantee, no questions asked. Cancel any time from Settings in two clicks — no email, no retention call.',
            },
            {
              q: 'Will my price go up?',
              a: 'The price is going up when MT4 and MT5 sync ships. The rate you join at is the rate you keep.',
            },
            {
              q: 'What happens to my data if I cancel?',
              a: 'It stays until you delete it, so resubscribing picks up where you left off. Delete your account from Settings and it goes.',
            },
          ]}
        />
      </Section>

      <p className="mt-10 text-[13px] text-gray-500 leading-relaxed">
        Something not answered here? Email{' '}
        <a
          href="mailto:tradenovaai@gmail.com"
          className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
        >
          tradenovaai@gmail.com
        </a>
        .
      </p>

      <ClosingCta />
    </PageShell>
  );
}
