import { useState } from 'react';
import PageShell from '../components/layout/PageShell';
import NovaAnswer from '../components/sales/NovaAnswer';
import { Split, Section, QA, ClosingCta } from '../components/marketing/blocks';
import { Frame, PullQuote, WeeklyReportPanel } from '../components/marketing/product';

/*
  Nova's own page.

  Nova is the thing the established journals do not have, and on the landing
  page it gets one section competing with eleven others. A trader comparing
  TradeX against a journal they already own is comparing this specifically, so
  it needs somewhere it is the only subject.

  Rebuilt from a column of cards into interface. The centrepiece is a question
  picker: real questions traders ask, each with the answer Nova would give.
  Tapping between them is the demo - it shows the range of what Nova can
  actually be asked far faster than a list of bullet points claiming the same
  thing, and it is the one interaction on this page that lands in under five
  seconds, which is the condition under which an interactive demo beats a
  static image at all.
*/

const CONVERSATIONS = [
  {
    q: 'Why am I losing on Fridays?',
    a: 'You are not. You are losing on the days you rate your focus below 5, and eleven of those fourteen days were Fridays. Your Friday setups win at the same rate as the rest of the week.',
  },
  {
    q: 'What is my worst habit?',
    a: 'Moving your stop. You did it on 4 of your last 6 losers, and in every case the original stop would have held. It has cost you roughly $1,180 across those six trades.',
  },
  {
    q: 'Am I actually improving?',
    a: 'Your P&L is flat, but your NOVA Score is up 9 points in six weeks — almost all of it discipline. You are breaking fewer rules. The money usually follows that, not the other way round.',
  },
  {
    q: 'Should I size up?',
    a: 'Not yet, and here is the honest reason: your risk management score is strong, but your biggest losses cluster on days you rated yourself rattled. Sizing up multiplies that, not your edge.',
  },
];

function AskNova() {
  const [active, setActive] = useState(0);

  return (
    <Frame label="Nova" note="Tap a question — these are the real kinds of answers">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CONVERSATIONS.map((c, i) => (
          <button
            key={c.q}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={`text-[11.5px] rounded-full px-3 py-1.5 border transition-colors text-left
              ${active === i
                ? 'border-brand-blue-light/40 bg-brand-blue/10 text-brand-blue-light'
                : 'border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
          >
            {c.q}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
            px-4 py-2.5 text-[13px] text-gray-300">
            {CONVERSATIONS[active].q}
          </p>
        </div>
        <div className="flex gap-2.5">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-blue/15 border border-brand-blue-light/30
            flex items-center justify-center text-[11px] font-medium text-brand-blue-light">
            N
          </span>
          <p className="max-w-[92%] rounded-2xl rounded-bl-sm bg-brand-blue/[0.07] border border-brand-blue-light/20
            px-4 py-3 text-[13px] leading-relaxed text-gray-300">
            {CONVERSATIONS[active].a}
          </p>
        </div>
      </div>
    </Frame>
  );
}

export default function Nova() {
  return (
    <PageShell
      width="wide"
      eyebrow="Nova"
      title="The part that reads your journal back to you"
      subtitle="Writing entries is work. Nova is the reason the work pays off — it reads every entry together and tells you what you keep doing."
    >
      <AskNova />

      <PullQuote>
        You cannot see the pattern from inside it. That is the entire problem.
      </PullQuote>

      <Split
        eyebrow="It has read your trades"
        title="Not a chatbot bolted onto a journal"
        lead="Nova queries your real history to answer, so the numbers in the reply are your numbers."
        points={[
          'Ask in plain language — no filters to set, no report to build first',
          'It runs the analysis itself rather than guessing',
          'It reads psychology, not just P&L',
          'Tell it what happened and it writes the journal entry for you',
        ]}
        visual={
          <Frame label="Nova — typing" note="Plays on its own">
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
                  px-4 py-2.5 text-[13px] text-gray-300">
                  Why am I losing on Fridays?
                </p>
              </div>
              <NovaAnswer />
            </div>
          </Frame>
        }
      />

      <Split
        flip
        eyebrow="Memory"
        title="It remembers you between conversations"
        lead="The thing that makes most AI assistants exhausting is re-explaining yourself every single time."
        points={[
          'Tell it something once and it is there next week',
          'Set your goals, risk tolerance and style — every answer is framed against them',
          'Advice for a scalper on a funded account is not advice for a swing trader',
          'Rate any answer down and it sharpens',
        ]}
        visual={
          <Frame label="What Nova remembers" note="Example memory">
            <div className="flex flex-col gap-2.5">
              {[
                'Working on cutting losers faster — set a hard 30-minute rule in August',
                'Trades London open, mostly EURUSD and GBPUSD',
                'On an FTMO $100k challenge, phase 1, since 2 September',
                'Says the revenge trading gets worse after a red morning',
              ].map((m) => (
                <div key={m} className="rounded-xl border border-white/[0.07] bg-brand-elevated px-3.5 py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-gray-400">{m}</p>
                </div>
              ))}
            </div>
          </Frame>
        }
      />

      <Split
        eyebrow="Reports"
        title="It writes the week up for you"
        lead="You do not have to ask. Every week Nova reads what you logged and tells you what changed."
        points={[
          'Weekly and monthly, from your own entries',
          'Rules kept, psychology trend and P&L together',
          'Written in sentences, not left as a chart to interpret',
        ]}
        visual={<WeeklyReportPanel />}
      />

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
