import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Circle, ArrowRight } from 'lucide-react';
import {
  saveInstrument, saveExperience, saveStruggle, markOnboardingComplete,
  type Instrument, type Experience, type Struggle,
} from '../services/onboarding';
import {
  SAMPLE_TRADES, STRUGGLE_CARD, INSTRUMENT_LABEL,
} from '../lib/onboardingPreview';
import { trackEvent } from '../lib/productAnalytics';
import MascotSays from '../components/shared/MascotSays';
import PreTradeScales, { type ScaleValues } from '../components/journal/PreTradeScales';

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

type Step = 0 | 1 | 2 | 'thinking' | 3;

/*
  The payoff screen leads with their answer, not with a product tour.

  It used to open "Here's what tracking forex trades looks like in TradeX"
  over a list of three trades and their P&L - which is the one thing every
  rival journal also shows, on the last screen before a price, in a product
  that is not sold on P&L. The commodity was the hero and the argument was
  underneath it.
*/
const PAYOFF_HEADLINE: Record<Struggle, string> = {
  revenge_trading: 'It\u2019s the next trade that costs you.',
  overtrading: 'Your best days are your quietest.',
  breaking_rules: 'You keep every rule that costs you nothing.',
  not_sure: 'You have a pattern. You just haven\u2019t seen it.',
};

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

/*
  The beat between the last answer and the preview.

  The preview is assembled from what they just said - their instrument,
  their struggle - and it used to appear the instant the third answer was
  tapped. Instant is not free: a screen that is suddenly different reads as
  a page change rather than as a result, and the work of tailoring it to
  them goes unnoticed because nothing showed it happening.

  So it says what it is doing, in his voice, and takes long enough to be
  read. 1.6s is the whole budget - long enough to register as thinking,
  short enough that nobody taps back out of a twenty-second flow.

  Not a fake loading bar. The lines name the three answers actually being
  used, so the wait is the product explaining itself rather than stalling.
*/
const THINKING_LINES = [
  'Reading your answers',
  /* Said "Picking the right example trades" while the example trades were on
     screen. They are not any more, so it describes what actually happens. */
  'Matching the pattern you picked',
  'Setting up your checks',
];

function Thinking({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    /*
      One timer per line and one to finish, all cleared together - a step
      that is left behind mid-count must not advance the flow underneath
      whatever replaced it.
    */
    const timers = [
      window.setTimeout(() => setLine(1), 520),
      window.setTimeout(() => setLine(2), 1040),
      window.setTimeout(onDone, 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center text-center">
      <MascotSays pose="lean" height={84} side="above" className="mb-7">
        Give me a second, I&rsquo;m setting this up for you.
      </MascotSays>

      <ul className="flex flex-col gap-3 w-full max-w-[260px]">
        {THINKING_LINES.map((text, i) => (
          <li key={text} className="flex items-center gap-3 text-left">
            {/*
              Done, doing, or not yet - shown by state rather than by a
              spinner that says only that something is happening.
            */}
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              {i < line ? (
                <Check size={15} className="text-brand-blue-light" strokeWidth={2.5} />
              ) : i === line ? (
                <motion.span
                  className="block w-1.5 h-1.5 rounded-full bg-brand-blue-light"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <span className="block w-1.5 h-1.5 rounded-full bg-white/15" />
              )}
            </span>
            <span
              className={`text-[14px] transition-colors duration-300 ${
                i <= line ? 'text-gray-200' : 'text-gray-600'
              }`}
            >
              {text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-8">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? 'w-6 bg-brand-blue-light' : i < (step as number) ? 'w-1.5 bg-brand-blue-light/50' : 'w-1.5 bg-white/15'
          }`}
        />
      ))}
      <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-gray-500">
        {Math.min((step as number) + 1, 3)} of 3
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
  /*
    Live, not a picture of the control.

    /pricing already argues this for its checklist - an interactive demo
    beats a screenshot when the point lands in about three seconds, and
    three taps on three rows is inside that. It is also the one claim a
    competitor cannot copy by adding an AI: TradeZella infers your state
    from your tone afterwards, this asks you to declare it before you click.
  */
  const [demoScales, setDemoScales] = useState<ScaleValues>({});
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
    setStep('thinking');
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

        {step === 'thinking' && <Thinking onDone={() => setStep(3)} />}

        {step === 3 && (
          <>
            {/*
              Bold, and allowed the full column.

              text-balance was evening the line lengths out, which on a
              headline this short meant breaking a sentence that had room to
              run - two cramped lines where one wide one fits. Dropped, and
              the tracking pulled in a notch to hold bold together at size.
            */}
            <h1 className="text-[27px] sm:text-[34px] leading-[1.12] font-bold tracking-[-0.038em]
              text-white text-center mb-3">
              {PAYOFF_HEADLINE[struggle]}
            </h1>
            <p className="text-center text-[13.5px] sm:text-[14.5px] text-gray-400 leading-relaxed
              max-w-lg mx-auto">
              Every journal records what the trade did. This one records what you were like
              before you took it.
            </p>

            {/*
              The differentiator, live, above everything else.

              Three taps and the argument is made physically rather than
              described. Unanswered stays visible as its own state, which is
              the whole design of the real control - "not rated" is not the
              same as "rated low".
            */}
            <div className="mt-5 sm:mt-7 rounded-2xl border border-brand-blue-light/30
              bg-brand-blue/[0.06] p-4 sm:p-5">
              <div className="flex items-baseline justify-between mb-3.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-brand-blue-light">
                  Before the trade
                </p>
                <p className="text-[11.5px] text-gray-500">Try it</p>
              </div>
              <PreTradeScales
                values={demoScales}
                onChange={(key, value) => setDemoScales((prev) => ({ ...prev, [key]: value }))}
              />
              <p className="mt-4 pt-3.5 border-t border-brand-blue-light/20 text-[13px]
                leading-relaxed text-gray-300">
                {Object.values(demoScales).filter((v) => v !== null && v !== undefined).length === 3
                  ? 'Three taps. Thirty of those and the pattern stops being an opinion.'
                  : 'Rate them the way you would before an entry.'}
              </p>
            </div>

            {/*
              The answer to the line above it, and nothing else.

              It was the card title, four findings and an outcome. Three of
              those findings were invented figures - "11 of your last 14 red
              days", "4 minutes" - on the screen immediately before a price,
              which is the worst place to be carrying numbers nobody can
              stand behind. The outcome line was always the strongest thing
              in the block and it needs no invented arithmetic to land.
            */}
            <p className="mt-4 sm:mt-5 text-center text-[15px] sm:text-[16.5px] leading-[1.55]
              text-gray-200 text-balance max-w-xl mx-auto">
              {card.outcome}
            </p>


            <div className="mt-5 sm:mt-7 text-center">
              <button
                type="button"
                onClick={() => {
                  trackEvent('onboarding_complete', { instrument, struggle });
                  void markOnboardingComplete();
                  void onComplete();
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
                  bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
              >
                Start 3 days free
                <ArrowRight size={17} />
              </button>
              {/*
                The same words as the button on the screen this leads to.

                It used to say "See plans", which is a navigation label -
                it asks somebody to go and look at prices, which is the
                lowest-intent thing a button can ask for, and it promised a
                comparison the paywall no longer runs. Carrying the paywall's
                own CTA here makes the two screens one promise rather than
                two, and the tap that follows is a confirmation instead of a
                second decision.

                The line under it stops repeating "three days free" now the
                button says it, and spends itself on the thing somebody is
                actually weighing at this point instead.
              */}
              <p className="mt-3 text-[12.5px] text-gray-500">
                Nothing charged today &middot; Cancel in two clicks
              </p>
            </div>
          </>
        )}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
