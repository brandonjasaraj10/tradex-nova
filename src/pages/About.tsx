import PageShell from '../components/layout/PageShell';
import { Link } from 'react-router-dom';
import { Section, Card, ClosingCta } from '../components/marketing/blocks';

/*
  The founder page.

  It exists mainly to take the founder video off the landing page. The
  research is fairly settled on this: founder videos earn their place on
  enterprise pages with long sales cycles, where a buyer wants to know who
  they are entering a year-long relationship with. For a self-serve product at
  $24.99 a month, a product demo converts substantially better in the same
  slot. The video is good, and it belongs somewhere - it just should not be
  competing with a demo for the same attention.

  Written carefully: the only biography on this page is what the founder has
  actually said publicly, which today is one sentence about quitting his own
  journal. Everything else is about how the product is built, which is true
  and verifiable. No invented years-of-experience, no invented team.
*/

export default function About() {
  return (
    <PageShell
      eyebrow="About"
      title="I kept quitting my own trading journal"
      subtitle="So I built the one I would actually keep. That is the whole origin story, and everything about TradeX follows from it."
    >
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black mb-3">
        <video
          className="w-full aspect-video bg-black"
          controls
          preload="metadata"
          playsInline
          poster="/founder-video-poster.jpg"
        >
          <source src="/founder-video.mp4" type="video/mp4" />
          Your browser doesn&rsquo;t support embedded video.
        </video>
      </div>
      <p className="text-[11px] text-gray-600">A couple of minutes on why this exists</p>

      <Section
        title="What we got wrong about journals"
        lead="Every journal on the market competes on features. None of them compete on the thing that actually decides whether journaling works."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="Journals do not fail on features. They fail at 4pm." accent>
            Nobody abandons a journal because it was missing a chart. They
            abandon it because typing up a trade is the last thing anyone wants
            to do after taking one. So the first problem TradeX solved was the
            typing, not the analytics.
          </Card>
          <Card title="P&L is the symptom, not the cause">
            Every journal will show you that you lost. Very few record how you
            were before you entered, which is where the answer usually is. That
            is why the psychology template exists and why it is filled in at the
            time rather than reconstructed later.
          </Card>
          <Card title="A record you never read is just homework">
            Writing entries only pays off if something reads them all together.
            That is Nova&rsquo;s entire job.
          </Card>
        </div>
      </Section>

      <Section
        title="How this gets built"
        lead="Worth saying plainly, because it is unusual and it affects what you should expect."
      >
        <div className="flex flex-col gap-3.5">
          <Card title="It is small, and it is not pretending not to be">
            TradeX is early. There is no compliance badge on the{' '}
            <Link
              to="/security"
              className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
            >
              security page
            </Link>{' '}
            for that reason &mdash; you get the architecture described honestly
            instead of a seal that would mean nothing.
          </Card>
          <Card title="Shipping is fast and it is visible">
            MT4 and MT5 sync is a couple of weeks away. Features arrive
            regularly, and when the price changes because of one, you are told
            before it happens rather than after.
          </Card>
          <Card title="Feedback goes straight to the person building it">
            Email{' '}
            <a
              href="mailto:tradenovaai@gmail.com"
              className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
            >
              tradenovaai@gmail.com
            </a>{' '}
            and it is read. Being early is the trade-off; being heard is the
            compensation.
          </Card>
        </div>
      </Section>

      <ClosingCta
        title="Build the habit that survives a bad week"
        body="Thirty seconds a trade, starting with today’s."
      />
    </PageShell>
  );
}
