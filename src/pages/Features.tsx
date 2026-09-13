import PageShell from '../components/layout/PageShell';
import { Section, Card, CardGrid, TickList, ClosingCta } from '../components/marketing/blocks';

/*
  The page for the buyer checking for gaps.

  It exists because three real parts of the product are mentioned nowhere on
  the public site: the psychology template, Nova's memory across sessions, and
  multi-account switching. The landing page is deliberately not the place to
  fix that - piling every feature into a three-step tour turns three clear
  ideas into twelve competing ones, and the research on landing pages is
  consistent that clarity beats completeness. This is where completeness
  belongs.

  Grouped by what a trader is trying to do, not by which part of the codebase
  a feature lives in. "Record the trade" is a job; "Journal module" is an org
  chart.
*/

export default function Features() {
  return (
    <PageShell
      eyebrow="Features"
      title="Everything TradeX does"
      subtitle="Grouped by what you are trying to do, rather than by which screen it happens to live on."
    >
      <Section
        title="Record the trade"
        lead="The part every journal gets wrong, because the part people quit over is the typing."
      >
        <CardGrid>
          <Card title="Voice journaling" accent>
            Hit record and talk like you would to a trading partner. Rambling is
            fine. TradeX pulls out symbol, direction, size, P&amp;L and your
            reasoning and files each in the right place.
          </Card>
          <Card title="Type it instead">
            Voice is the fast path, not the only one. The full entry form is
            there whenever you would rather write.
          </Card>
          <Card title="CSV import">
            Upload the statement your broker exports and your history comes in
            at once, rather than being retyped an evening at a time.
          </Card>
          <Card title="Screenshots and tags">
            Attach the chart, tag the setup. Tags are searchable later, which is
            how &ldquo;every time I traded this&rdquo; becomes a question you can
            actually answer.
          </Card>
        </CardGrid>
      </Section>

      <Section
        title="Record how you were, not just what you did"
        lead="The difference between seeing that you lost and seeing why. This is the part no spreadsheet has."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="The psychology template" accent>
            A structured entry for the state you were actually in: pre-trade
            mindset and intention, mood, focus, the feeling during the trade and
            what you made of it afterwards. Filled in at the time, so it is a
            record rather than a reconstruction.
          </Card>
          <Card title="Psychology scoring">
            Those entries are scored rather than just stored, so patterns in how
            you were feeling can be matched against patterns in what you earned.
          </Card>
          <Card title="The NOVA Score">
            One number across five components &mdash; consistency, risk
            management, profitability, discipline and execution &mdash; so
            &ldquo;am I getting better?&rdquo; has an answer that is not just this
            month&rsquo;s P&amp;L.
          </Card>
          <Card title="Pre-trade checklists">
            Your own list, ticked before you enter rather than judged
            afterwards. Built for the rules you keep breaking.
          </Card>
        </div>
      </Section>

      <Section
        title="Find out what you keep doing"
        lead="Across every entry, not one at a time."
      >
        <CardGrid>
          <Card title="Nova, your AI analyst" accent>
            Ask a plain question and get an answer drawn from your own trades.
            Nova remembers what you have told it in previous conversations, so
            you are not re-explaining yourself every session.
          </Card>
          <Card title="Weekly and monthly reports">
            What happened, what changed, and what it thinks is behind it &mdash;
            written, not just charted.
          </Card>
          <Card title="Performance analytics">
            Cumulative P&amp;L, win rate trend, P&amp;L by symbol, average P&amp;L
            by day of week, and trade types.
          </Card>
          <Card title="Trading calendar">
            Your month laid out day by day, so a bad stretch is something you
            can see the shape of.
          </Card>
        </CardGrid>
      </Section>

      <Section
        title="Keep yourself honest"
        lead="Rules are easy to write and easy to quietly stop following."
      >
        <CardGrid>
          <Card title="Trading rules">
            Write the rules you trade by, then mark against each entry whether
            you actually followed them. The gap between the two is the report.
          </Card>
          <Card title="Confluences">
            Define what has to line up before you take a setup, and record which
            of them were really present.
          </Card>
          <Card title="Trade log">
            Every position in one searchable list &mdash; by symbol, setup, note
            or tag &mdash; rather than scrolling a calendar hunting for one
            trade.
          </Card>
          <Card title="Notes">
            A place for the thinking that is not attached to a single trade.
          </Card>
        </CardGrid>
      </Section>

      <Section
        title="Run more than one account"
        lead="Prop challenge, funded account and personal capital are three different traders. TradeX treats them that way."
      >
        <Card>
          Up to five accounts, each with its own trades, balance, analytics and
          NOVA Score, and a selector at the top to switch between them. Metrics
          follow the account you are looking at, so a funded account&rsquo;s
          numbers are never quietly averaged in with a demo&rsquo;s.
        </Card>
      </Section>

      <Section title="All of it, in one plan" lead="Nothing here is an add-on.">
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
