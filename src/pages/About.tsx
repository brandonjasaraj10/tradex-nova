import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import PreTradeScales from '../components/journal/PreTradeScales';
import TranscriptToEntry from '../components/sales/TranscriptToEntry';
import { Split, Section, ClosingCta } from '../components/marketing/blocks';
import { Frame, PullQuote, ShippedTimeline, StatBand } from '../components/marketing/product';

/*
  The founder page.

  It exists mainly to take the founder video off the landing page. The
  research is fairly settled: founder videos earn their place on enterprise
  pages with long sales cycles, where a buyer wants to know who they are
  entering a year-long relationship with. For a self-serve product at $24.99 a
  month, a product demo converts better in the same slot. The video is good
  and it belongs somewhere - it just should not be competing with a demo.

  Rebuilt from a stack of cards. Two rules held while doing it.

  The only biography is what the founder has actually said publicly, which
  today is one sentence about quitting his own journal. No invented years of
  experience, no invented team, no city.

  And no traction numbers. It is early, user counts move, and a page that
  brags about a figure it will outgrow in a month is a page that has to be
  rewritten in a month. The shipping timeline does that job better anyway:
  every entry on it is a real dated commit, which is the only version of "we
  ship fast" a reader can actually check.
*/

function WhyItDies() {
  /*
    The demo sits in the argument rather than after it. The claim is that
    journals fail on effort, not features - so the thing to show is the
    effort being removed, which is what this component does.
  */
  return (
    <Frame label="Journal — new entry" note="Plays on its own">
      <TranscriptToEntry />
    </Frame>
  );
}

function StateDemo() {
  const [values, setValues] = useState<Record<string, number | null>>({
    emotional_state: 2,
    focus: 2,
    confidence: 4,
  });
  return (
    <Frame label="Before you enter" note="The real thing — try it">
      <PreTradeScales
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
      <p className="mt-3.5 text-[11.5px] leading-relaxed text-gray-600">
        Rattled, scattered, and certain anyway. Every trader recognises that
        row. Almost no journal records it.
      </p>
    </Frame>
  );
}

export default function About() {
  return (
    <PageShell
      width="wide"
      eyebrow="About"
      title="I kept quitting my own trading journal"
      subtitle="So I built the one I would actually keep. That is the whole origin story, and everything about TradeX follows from it."
    >
      <div className="max-w-3xl">
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
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
        <p className="mt-2.5 text-[11px] text-gray-600">A couple of minutes on why this exists</p>
      </div>

      <PullQuote>
        Nobody stops journaling. They stop logging the bad days.
      </PullQuote>

      <Split
        eyebrow="What everyone got wrong"
        title="Nobody quits a journal over a missing chart"
        lead="People do not abandon a journal all at once. They skip the trade they would rather forget, which is the one that had something to teach them. So the journal ends up with a hole exactly where the lesson was."
        points={[
          'Every journal on the market competes on features',
          'None of them compete on whether the worst days make it in',
          'Writing down a bad result makes it hurt more, so it gets skipped',
          'Talking takes thirty seconds, and Nova does the looking back',
        ]}
        visual={<WhyItDies />}
      />

      <Split
        flip
        eyebrow="The second thing"
        title="P&L is the symptom, not the cause"
        lead="Every journal will show you that you lost. Very few record how you were before you entered, which is usually where the answer is."
        points={[
          'Rated at the time, so it is a record rather than a reconstruction',
          'Matched against what actually happened, across every entry',
          'Seeing that you lost and seeing why you lost are different things',
          'This is the part that made building another journal worth doing',
        ]}
        visual={<StateDemo />}
      />

      <Section
        eyebrow="Shipping"
        title="What has actually shipped"
        lead="Not a roadmap. Real dates, from the commit history — including the one thing that has not landed yet."
      >
        <ShippedTimeline />
      </Section>

      <div className="my-12 sm:my-16">
        <StatBand
          items={[
            { value: '1', label: 'Plan, with everything in it' },
            { value: '14', label: 'Days money back, no questions asked' },
            { value: '0', label: 'Compliance badges we have not earned' },
          ]}
        />
      </div>

      <Section
        eyebrow="Straight about it"
        title="How this gets built"
        lead="Worth saying plainly, because it is unusual and it changes what you should expect."
      >
        <div className="grid sm:grid-cols-3 gap-3.5">
          {[
            {
              t: 'It is small, and not pretending otherwise',
              b: (
                <>
                  There is no compliance badge on the{' '}
                  <Link to="/security" className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors">
                    security page
                  </Link>{' '}
                  because none has been earned. You get the architecture
                  described honestly instead of a seal that would mean nothing.
                </>
              ),
            },
            {
              t: 'Price changes are announced first',
              b: (
                <>
                  If the price goes up, you are told before it happens, and
                  the rate you joined at is the rate you keep.
                </>
              ),
            },
            {
              t: 'Feedback reaches the person building it',
              b: (
                <>
                  Email{' '}
                  <a
                    href="mailto:tradenovaai@gmail.com"
                    className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
                  >
                    tradenovaai@gmail.com
                  </a>{' '}
                  and it gets read. Being early is the trade-off; being heard is
                  the compensation.
                </>
              ),
            },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5">
              <h3 className="text-[14.5px] font-medium text-white mb-2 tracking-[-0.01em] text-balance">{c.t}</h3>
              <p className="text-[13px] leading-relaxed text-gray-400">{c.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <ClosingCta
        title="Build the habit that survives a bad week"
        body="Thirty seconds a trade, starting with today’s."
      />
    </PageShell>
  );
}
