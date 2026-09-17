import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Circle, ArrowRight } from 'lucide-react';
import {
  saveInstrument, saveExperience, saveStruggle,
  type Instrument, type Experience, type Struggle,
} from '../services/onboarding';
import {
  SAMPLE_TRADES, STRUGGLE_CARD, INSTRUMENT_LABEL,
} from '../lib/onboardingPreview';
import { trackEvent } from '../lib/productAnalytics';
import MascotSays from '../components/shared/MascotSays';

/*
  Three questions and a preview, between signing up and seeing a price.

  The whole sequence is meant to take under twenty seconds of clicking, so
  every screen is one tap and nothing here has a Next button - choosing IS
  advancing. A question that needs a selection and then a confirmation is
  two taps for one decision, and three of those is most of the twenty
  seconds spent on ceremony.

  Nothing is typed. Free text would collect better answers from the handful
  of people who write them and cost the rest their patience, and these
  answers exist to be counted rather than read.

  The third question is the one that earns its place: somebody who has just
  said "revenge trading after a loss" is then shown the cooldown check, and
  the connection between the two is the argument for paying. The first two
  are cheap to answer and make the third feel like a conversation rather
  than an interrogation.
*/

type Step = 0 | 1 | 2 | 3;

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: 'futures', label: 'Futures' },
  { value: 'forex', label: 'Forex' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'crypto', label: 'Crypto' },
];

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: 'just_started', label: 'Just started' },
  { value: 'under_1_year', label: 'Under 1 year' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
];

/*
  Worded as they would say it, not as a product would. "What's actually
  costing you money right now" gets a different answer than "what are your
  trading challenges", and the answer it gets is the one worth having.
*/
const STRUGGLES: { value: Struggle; label: string }[] = [
  { value: 'revenge_trading', label: 'Revenge trading after a loss' },
  { value: 'overtrading', label: 'Overtrading, no patience' },
  { value: 'breaking_rules', label: 'Breaking my own rules' },
  { value: 'not_sure', label: "No idea, that's the problem" },
];

function ProgressDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-8">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? 'w-6 bg-brand-blue-light' : i < step ? 'w-1.5 bg-brand-blue-light/50' : 'w-1.5 bg-white/15'
          }`}
        />
      ))}
      <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-gray-500">
        {Math.min(step + 1, 3)} of 3
      </span>
    </div>
  );
}

/*
  One tap, full width, generous target.

  These are read on a phone by somebody who has just typed a password, so
  the rows are large and there is nothing else on screen to hit by mistake.
*/
function Choice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-5 py-4 rounded-xl border border-white/10 bg-brand-surface
        text-[15px] text-gray-200 transition-colors
        hover:border-brand-blue-light/40 hover:bg-brand-blue/[0.07] hover:text-white
        focus-visible:outline-none focus-visible:border-brand-blue-light/60"
    >
      {label}
    </button>
  );
}

function Question({
  step, title, options, onChoose,
}: {
  step: Step;
  title: string;
  options: { value: string; label: string }[];
  onChoose: (value: string) => void;
}) {
  return (
    <>
      <ProgressDots step={step} />
      <h1 className="text-[26px] sm:text-[32px] leading-[1.15] font-semibold tracking-[-0.03em]
        text-white text-balance text-center mb-7">
        {title}
      </h1>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <Choice key={o.value} label={o.label} onClick={() => onChoose(o.value)} />
        ))}
      </div>
    </>
  );
}

/*
  onComplete hands control back to the layout, which then shows whatever
  comes next - the paywall for somebody who has not paid, the app for
  somebody who has. This screen deliberately does not decide that itself;
  it has no business knowing about subscriptions.
*/
export default function Onboarding({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [step, setStep] = useState<Step>(0);
  const [instrument, setInstrument] = useState<Instrument>('forex');
  const [struggle, setStruggle] = useState<Struggle>('not_sure');

  /*
    Saved and advanced together, and the save is not awaited. A write that
    takes 300ms should not be 300ms of a twenty-second flow spent watching a
    button that has already been pressed - and the answer is stored on a
    best-effort basis by design (see services/onboarding).
  */
  const answerOne = (value: string) => {
    const v = value as Instrument;
    setInstrument(v);
    void saveInstrument(v);
    trackEvent('onboarding_q1', { instrument: v });
    setStep(1);
  };

  const answerTwo = (value: string) => {
    void saveExperience(value as Experience);
    trackEvent('onboarding_q2', { experience: value });
    setStep(2);
  };

  const answerThree = (value: string) => {
    const v = value as Struggle;
    setStruggle(v);
    void saveStruggle(v);
    trackEvent('onboarding_q3', { struggle: v });
    setStep(3);
  };

  const trades = SAMPLE_TRADES[instrument];
  const card = STRUGGLE_CARD[struggle];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-5 py-8 sm:py-12">
      {/*
        One step fades out as the next slides in, rather than the screen
        simply being different.

        Tapping an answer used to swap the content in a single frame, which
        reads as a page failing to load rather than as progress. 180ms is
        enough to see the change happen and short enough that three of them
        cost half a second of a twenty-second flow.

        mode="wait" so the outgoing step finishes before the incoming one
        starts - overlapping them puts two headings on screen at once, which
        is worse than the abrupt version it replaces.
      */}
      <div className={step === 3 ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
        {step === 0 && (
          <>
            {/*
              He greets on the first screen and nowhere else in the flow.

              Activation is the metric this screen moves - it is the single
              strongest predictor of long-term retention and revenue, and the
              SaaS median is 37.5% against 65-75% in the top quartile - and
              the thing that loses it here is somebody deciding three
              questions is more work than it is. Saying how short it is, in
              a character's voice rather than as another line of grey helper
              text, is the cheapest thing that addresses that.

              Once, not on all three. Repeating him down every step would add
              height to a twenty-second flow and turn a greeting into
              furniture, and the drop-off this fights is at the start.
            */}
            <MascotSays pose="wave" height={84} side="above" className="mb-6">
              Three taps and I&rsquo;ll set this up for you.
            </MascotSays>

            <Question
              step={0}
              title="What do you trade?"
              options={INSTRUMENTS}
              onChoose={answerOne}
            />
          </>
        )}

        {step === 1 && (
          <Question
            step={1}
            title="How long have you been trading?"
            options={EXPERIENCE}
            onChoose={answerTwo}
          />
        )}

        {step === 2 && (
          <Question
            step={2}
            title="What's actually costing you money right now?"
            options={STRUGGLES}
            onChoose={answerThree}
          />
        )}

        {step === 3 && (
          <>
            <h1 className="text-[26px] sm:text-[32px] leading-[1.15] font-semibold tracking-[-0.03em]
              text-white text-balance text-center mb-2">
              Here&rsquo;s what tracking {INSTRUMENT_LABEL[instrument]} trades looks like in TradeX.
            </h1>

            {/*
              The trade log first, because it is the familiar half - it is
              what every journal claims - and it is doing the work of showing
              the product full rather than empty.
            */}
            <div className="mt-5 sm:mt-7 rounded-2xl border border-white/10 bg-brand-surface overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-white/[0.07] flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Your trades</p>
                <p className="text-[11px] text-gray-600">Example</p>
              </div>
              {/*
                Stacked rows, not a table.

                It WAS a table, and at 375px it measured 520px wide inside a
                333px container - so reading the P&L meant dragging the
                trades sideways, on the screen that is meant to sell the
                product. A row per trade fits any width and says the same
                thing: what it was, and what it made.
              */}
              <ul>
                {trades.map((t) => (
                  <li
                    key={t.symbol}
                    className="px-4 sm:px-5 py-3 border-b border-white/[0.05] last:border-0"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-white text-[14px]">
                        {t.symbol}
                        <span className="ml-2 text-[12px] font-normal text-gray-500">
                          {t.direction} &middot; {t.size}
                        </span>
                      </p>
                      <p className={`text-[14px] font-medium tabular-nums whitespace-nowrap
                        ${t.pnl >= 0 ? 'text-brand-blue-light' : 'text-gray-400'}`}>
                        {t.pnl >= 0 ? '+' : '−'}${Math.abs(t.pnl).toLocaleString()}
                      </p>
                    </div>
                    {/*
                      The note is the point of the whole product, so it stays
                      on the small screen where the prices do not.
                    */}
                    <p className="mt-1 text-[12px] text-gray-500 leading-snug">{t.note}</p>
                    <p className="mt-0.5 hidden sm:block text-[12px] text-gray-600 tabular-nums">
                      {t.entry} &rarr; {t.exit}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/*
              And the card they actually came for, tied to what they said
              thirty seconds ago. Given the blue treatment because this is
              the one thing on the screen that no other journal does.
            */}
            <div className="mt-3 sm:mt-4 rounded-2xl border border-brand-blue-light/30 bg-brand-blue/[0.06] p-3.5 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-blue-light mb-3.5">
                {card.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {card.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                    {item.state === 'flagged' && (
                      <AlertTriangle size={15} className="mt-[3px] flex-shrink-0 text-brand-blue-light" />
                    )}
                    {item.state === 'ok' && (
                      <Check size={15} className="mt-[3px] flex-shrink-0 text-gray-500" strokeWidth={2.5} />
                    )}
                    {item.state === 'pending' && (
                      <Circle size={15} className="mt-[3px] flex-shrink-0 text-gray-600" />
                    )}
                    <span className={item.state === 'flagged' ? 'text-white' : 'text-gray-400'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 pt-3.5 border-t border-brand-blue-light/20 text-[13px] text-gray-300 leading-relaxed">
                {card.outcome}
              </p>
            </div>

            <p className="mt-3 text-center text-[12.5px] text-gray-500 leading-relaxed">
              This is what you&rsquo;ll be looking at daily. No broker connection needed to start.
            </p>

            <div className="mt-5 sm:mt-8 text-center">
              <p className="text-[15px] text-gray-300 mb-3.5">
                Ready to start tracking your own trades?
              </p>
              <button
                type="button"
                onClick={() => {
                  trackEvent('onboarding_complete', { instrument, struggle });
                  void onComplete();
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
                  bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
              >
                See plans
                <ArrowRight size={17} />
              </button>
            </div>
          </>
        )}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
