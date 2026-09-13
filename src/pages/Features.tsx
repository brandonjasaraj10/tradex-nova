import PageShell from '../components/layout/PageShell';
import NOVAScore from '../components/shared/NOVAScore';
import PreTradeScales from '../components/journal/PreTradeScales';
import TranscriptToEntry from '../components/sales/TranscriptToEntry';
import NovaAnswer from '../components/sales/NovaAnswer';
import { useState } from 'react';
import { Split, Section, TickList, ClosingCta } from '../components/marketing/blocks';
import {
  Frame,
  StatBand,
  PullQuote,
  CalendarPanel,
  ChecklistPanel,
  WeeklyReportPanel,
  AccountsPanel,
  EquityPanel,
} from '../components/marketing/product';
import { EXAMPLE_SCORE } from '../components/marketing/exampleScore';

/*
  The page for the buyer checking for gaps.

  Rebuilt after the first version came out as a column of identical bordered
  cards - accurate and unreadable, particularly on a phone. The research on
  product pages is consistent: lead with real interface rather than
  descriptions of it, and an interactive piece draws roughly twice the
  engagement of a static image where the point lands in seconds.

  So every section here is a piece of the actual product beside the sentence
  explaining it, and the sides alternate so the page has a rhythm rather than
  a stack. Three of the panels are genuinely interactive. Two of them - the
  NOVA Score and the pre-trade scales - are the real components the app
  renders, imported rather than redrawn, so a marketing page cannot drift
  away from the product it is selling.
*/

function ScalesDemo() {
  /*
    The real pre-trade scales, live. Someone can rate themselves on this page
    and see what the journal actually asks for, which is a faster answer to
    "what is the psychology bit?" than any paragraph.
  */
  const [values, setValues] = useState<Record<string, number | null>>({
    emotional_state: 3,
    focus: 2,
    confidence: 4,
  });
  return (
    <Frame label="Before you enter" note="Try it — this is the real thing">
      <PreTradeScales
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
    </Frame>
  );
}

export default function Features() {
  return (
    <PageShell
      width="wide"
      eyebrow="Features"
      title="Everything TradeX does"
      subtitle="Shown, rather than listed. Three of the panels below are live — tap them."
    >
      <EquityPanel />

      <div className="my-12 sm:my-16">
        <StatBand
          items={[
            { value: '30s', label: 'To log a trade, start to finish' },
            { value: '5', label: 'Accounts, each scored separately' },
            { value: '1', label: 'Plan, with all of this in it' },
          ]}
        />
      </div>

      <Split
        eyebrow="Record the trade"
        title="Talk. It writes the entry."
        lead="The reason journals die is the typing, so TradeX takes it off you. Ramble at it like you would a trading partner."
        points={[
          'Symbol, direction, size and P&L pulled out and filed',
          'Your reasoning organised into what actually happened',
          'Type it instead whenever you would rather',
          'Or import a CSV and bring your whole history in at once',
        ]}
        visual={
          <Frame label="Journal — new entry" note="Plays on its own">
            <TranscriptToEntry />
          </Frame>
        }
      />

      <Split
        flip
        eyebrow="Psychology"
        title="How you were, not just what you did"
        lead="Rated before you enter, so it is a record rather than a reconstruction. This is the part no spreadsheet has ever had."
        points={[
          'Emotional state, focus and confidence, taken at the time',
          'A full psychology template for the longer write-up',
          'Scored, so feeling can be matched against earnings',
          'Unanswered stays unanswered — it is not the same as a low rating',
        ]}
        visual={<ScalesDemo />}
      />

      <PullQuote>
        Every journal shows you that you lost. Almost none of them record why.
      </PullQuote>

      <Split
        eyebrow="NOVA Score"
        title="One number for “am I getting better?”"
        lead="Five components plus psychology, so the answer is not just this month’s P&L. Open it up and see which one is dragging."
        points={[
          'Consistency, risk management, profitability, discipline, execution',
          'Psychology folded in once you have rated enough trades',
          'Scored per account, never averaged across them',
          'Moves on behaviour, not on one lucky week',
        ]}
        visual={
          <Frame label="Dashboard — NOVA Score">
            <NOVAScore breakdown={EXAMPLE_SCORE} size="md" showBreakdown periodLabel="Last 30 days" />
          </Frame>
        }
      />

      <Split
        flip
        eyebrow="Nova AI"
        title="Ask it anything about your trading"
        lead="Nova reads every entry together and answers in plain language, with your real numbers in the answer."
        points={[
          'It queries your actual trades rather than guessing',
          'It remembers what you told it in previous conversations',
          'It can write the journal entry for you',
          'Rate any answer down and it sharpens',
        ]}
        visual={
          <Frame label="Nova" note="Example conversation">
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
        eyebrow="Rules & confluences"
        title="The rule you keep breaking, in front of you"
        lead="Ticked before you enter, rather than judged afterwards. The gap between what you wrote and what you did is the report."
        points={[
          'Your own rules and confluences, written once',
          'Marked per trade, so the pattern is countable',
          '“You moved your stop on 4 of your last 6 losers”',
          'Weekly reports show which rules slipped and when',
        ]}
        visual={<ChecklistPanel />}
      />

      <Split
        flip
        eyebrow="Calendar"
        title="A bad stretch has a shape"
        lead="Your month laid out day by day, in P&L or in psychology. Three losing days in a row look different from three spread across a month."
        points={[
          'Every day coloured by result, or by how you felt',
          'Journal-only days marked so nothing looks like a gap',
          'Click any day to open what you wrote',
          'Weekly reviews sit alongside each week',
        ]}
        visual={<CalendarPanel />}
      />

      <Split
        eyebrow="Reports"
        title="Written, not just charted"
        lead="A chart tells you what happened. The weekly and monthly reports tell you what changed and what is behind it."
        points={[
          'Weekly and monthly, generated from your own entries',
          'Rules kept, psychology trend and P&L in one place',
          'Full analytics underneath: cumulative P&L, win rate trend, P&L by symbol, average P&L by day of week, trade types',
        ]}
        visual={<WeeklyReportPanel />}
      />

      <Split
        flip
        eyebrow="Multiple accounts"
        title="A challenge and a funded account are two different traders"
        lead="Up to five, each with its own trades, balance, analytics and score. Switch at the top and every screen follows."
        points={[
          'Prop challenge, funded account and personal capital kept apart',
          'A demo you are messing about on never drags a live score down',
          'CSV import per account',
        ]}
        visual={<AccountsPanel />}
      />

      <Section title="All of it, in one plan" lead="Nothing here is an add-on, and nothing is held back to sell you later.">
        <TickList
          items={[
            'Voice journaling',
            'Nova AI analysis',
            'Psychology template & scoring',
            'NOVA Score',
            'Pre-trade checklists',
            'Weekly & monthly reports',
            'Trading rules & confluences',
            'Performance analytics',
            'Trading calendar',
            'Searchable trade log',
            'Unlimited trades',
            'Up to 5 accounts',
            'CSV import',
            'Notes',
          ]}
        />
      </Section>

      <ClosingCta />
    </PageShell>
  );
}
