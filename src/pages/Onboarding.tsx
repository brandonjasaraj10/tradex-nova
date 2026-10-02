import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import {
  saveInstrument, saveExperience, saveStruggles, saveProfileAnswers,
  markOnboardingComplete,
  type Instrument, type Experience, type Struggle,
} from '../services/onboarding';
import { STRUGGLE_CARD } from '../lib/onboardingPreview';
import {
  PROFILE_QUESTIONS, buildPlan, type ProfileAnswers,
} from '../lib/onboardingPlan';
import { trackEvent } from '../lib/productAnalytics';
import { emphasise } from '../lib/emphasise';
import MascotSays from '../components/shared/MascotSays';
import FirstEntry from '../components/onboarding/FirstEntry';
import type { VoiceJournalData } from '../services/voiceJournal';
import PreTradeScales, { type ScaleValues } from '../components/journal/PreTradeScales';

/*
  Eight questions and a plan, between signing up and seeing a price.

  WHAT THIS REPLACED, AND WHY

  Three taps and a preview. It was built to take under twenty seconds, on the
  reasoning that a short flow loses fewer people. It did lose almost nobody -
  and it also convinced almost nobody: 762 signups in thirty days, 49 of whom
  ever reached a card. Roughly seven hundred people saw the price and said
  no. The flow was not failing to hold them, it was failing to make a case.

  Across 1,460 onboarding flows the average app runs 25 screens, finance is
  the longest category, and several of the longest belong to the most
  successful apps. The founder of a $40k/month app puts it plainly: "we want
  the onboarding to be long... users feel like they are building value for
  themselves." Length is not the cost it looks like, as long as every screen
  is about the person answering it.

  So this is longer on purpose, and every question is about them.

  THE SHAPE

    welcome     one screen confirming they made a good decision
    3 x basics  instrument, experience, what is costing them money
    5 x profile the gap between what they know and what they do
    thinking    the beat where their answers become something
    plan        what the next fortnight produces, with a date on it

  Still one tap per screen, except the multi-select and the plan. Nothing is
  typed: free text collects better answers from the few who write them and
  costs everyone else their patience.

  THE PLAN SCREEN IS THE POINT. The strongest flows studied do not just
  collect answers, they show what the answers unlocked - Speak names what you
  will be able to do in two months, Byte Pal names the date you hit your
  goal. Everything before it exists to make that screen land.
*/

type Step =
  | 'welcome'
  | 'instrument'
  | 'experience'
  | 'struggles'
  | { profile: number }
  | 'thinking'
  | 'plan'
  | 'entry';

const QUESTION_COUNT = 3 + PROFILE_QUESTIONS.length;

function questionIndex(step: Step): number | null {
  if (step === 'instrument') return 0;
  if (step === 'experience') return 1;
  if (step === 'struggles') return 2;
  if (typeof step === 'object') return 3 + step.profile;
  return null;
}

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
  { value: 'not_sure', label: 'No idea. That’s the problem.' },
];

const THINKING_LINES = [
  'Reading your answers',
  'Matching the pattern you picked',
  'Building your first two weeks',
];

function Thinking({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    /*
      One timer per line and one to finish, all cleared together - a step
      left behind mid-count must not advance the flow underneath whatever
      replaced it.
    */
    const timers = [
      window.setTimeout(() => setLine(1), 560),
      window.setTimeout(() => setLine(2), 1120),
      window.setTimeout(onDone, 1750),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center text-center">
      <MascotSays pose="lean" height={84} side="above" className="mb-7">
        Give me a second, I&rsquo;m putting this together.
      </MascotSays>

      <ul className="flex flex-col gap-3 w-full max-w-[280px]">
        {THINKING_LINES.map((text, i) => (
          <li key={text} className="flex items-center gap-3 text-left">
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

/*
  A bar rather than three dots, now the flow is eight questions long.

  Dots stop meaning anything past about five, and the count matters here: a
  flow that is visibly nearly finished is one people finish.
*/
function Progress({ step }: { step: Step }) {
  const index = questionIndex(step);
  if (index === null) return null;
  const pct = ((index + 1) / QUESTION_COUNT) * 100;

  return (
    <div className="mb-8">
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-brand-blue-light"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <p className="mt-2.5 text-[11px] uppercase tracking-[0.14em] text-gray-500 text-center">
        {index + 1} of {QUESTION_COUNT}
      </p>
    </div>
  );
}

/*
  One tap, full width, generous target.

  These are read on a phone by somebody who has just typed a password, so the
  rows are large and there is nothing else on screen to hit by mistake.
*/
function Choice({
  label, onClick, selected = false,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-5 py-4 rounded-xl border text-[15px] transition-colors
        flex items-center justify-between gap-3
        focus-visible:outline-none focus-visible:border-brand-blue-light/60 ${
        selected
          ? 'border-brand-blue-light/60 bg-brand-blue/[0.12] text-white'
          : 'border-white/10 bg-brand-surface text-gray-200 hover:border-brand-blue-light/40 hover:bg-brand-blue/[0.07] hover:text-white'
      }`}
    >
      <span>{label}</span>
      {selected && <Check size={17} className="flex-shrink-0 text-brand-blue-light" strokeWidth={2.5} />}
    </button>
  );
}

function Question({
  step, title, subtitle, options, onChoose,
}: {
  step: Step;
  title: string;
  subtitle?: string;
  options: { value: string; label: string }[];
  onChoose: (value: string) => void;
}) {
  return (
    <>
      <Progress step={step} />
      <h1 className="text-[26px] sm:text-[32px] leading-[1.15] font-semibold tracking-[-0.03em]
        text-white text-balance text-center mb-2">
        {title}
      </h1>
      {subtitle && (
        <p className="text-center text-[13.5px] text-gray-500 mb-6">{subtitle}</p>
      )}
      <div className={`flex flex-col gap-2.5 ${subtitle ? '' : 'mt-5'}`}>
        {options.map((o) => (
          <Choice key={o.value} label={o.label} onClick={() => onChoose(o.value)} />
        ))}
      </div>
    </>
  );
}

export default function Onboarding({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [step, setStep] = useState<Step>('welcome');
  const [instrument, setInstrument] = useState<Instrument>('forex');
  const [struggles, setStruggles] = useState<Struggle[]>([]);
  const [profile, setProfile] = useState<ProfileAnswers>({});

  /*
    Live, not a picture of the control - the real component, so this cannot
    drift from the product it is selling.
  */
  const [demoScales, setDemoScales] = useState<ScaleValues>({});

  /*
    Fourteen days from the moment they see the plan, which is what the trial
    actually gives them. Computed once so it cannot shift between renders.
  */
  const trialEnds = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  }, []);

  const plan = useMemo(
    () => buildPlan(struggles, profile, trialEnds),
    [struggles, profile, trialEnds],
  );

  const primaryStruggle: Struggle = struggles[0] ?? 'not_sure';
  const card = STRUGGLE_CARD[primaryStruggle];

  const answerInstrument = (value: string) => {
    const v = value as Instrument;
    setInstrument(v);
    void saveInstrument(v);
    trackEvent('onboarding_q1', { instrument: v });
    setStep('experience');
  };

  const answerExperience = (value: string) => {
    const v = value as Experience;
    void saveExperience(v);
    trackEvent('onboarding_q2', { experience: v });
    setStep('struggles');
  };

  const toggleStruggle = (value: Struggle) => {
    setStruggles((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  };

  const confirmStruggles = () => {
    void saveStruggles(struggles);
    trackEvent('onboarding_q3', { struggle: struggles[0] ?? null, count: struggles.length });
    setStep({ profile: 0 });
  };

  const answerProfile = (index: number, value: string) => {
    const q = PROFILE_QUESTIONS[index];
    const next = { ...profile, [q.id]: value };
    setProfile(next);
    trackEvent('onboarding_profile', { question: q.id, answer: value });

    if (index + 1 < PROFILE_QUESTIONS.length) {
      setStep({ profile: index + 1 });
      return;
    }

    /*
      Written once, here, rather than per question - see saveProfileAnswers.
      Nothing reads these until the plan renders from state a moment later,
      so the write has the whole thinking beat to land.
    */
    void saveProfileAnswers(next);
    trackEvent('onboarding_profile_complete', { answered: Object.keys(next).length });
    setStep('thinking');
  };

  /*
    Awaited, in order, because the two used to race - and the race was
    visible.

    markOnboardingComplete() writes the timestamp and onComplete() re-reads
    the profile. Fired together, the read usually won: it fetched a profile
    whose timestamp was still null, the gate in App.tsx renders onboarding
    for exactly as long as that is null, and so the screen simply stayed
    put. Tapping the last button in the flow did nothing visible while
    silently succeeding in the database - the worst shape a bug can have,
    because the only recovery a user has is to tap it again.

    Caught by walking the flow as a new account rather than by reading it;
    the write had landed and the screen had not moved.
  */
  const [finishing, setFinishing] = useState(false);

  const finish = async (entry: VoiceJournalData | null, transcript: string) => {
    if (finishing) return;
    setFinishing(true);

    /*
      Kept on the device, not written to the database.

      journal_entries requires an active subscription at the RLS level, so
      there is nowhere to put this until they subscribe - and carving an
      exception into the paywall for one row is not a trade worth making.
      Stashed here instead, for the subscription flow to pick up and write.

      Wrapped, because storage throws outright in some privacy modes and in
      embedded browsers - which is most of this traffic - and losing a
      stashed entry must never cost somebody the end of their signup.
    */
    if (entry) {
      try {
        localStorage.setItem(
          'tradex.onboarding.firstEntry',
          JSON.stringify({ entry, transcript, at: Date.now() }),
        );
      } catch {
        /* nothing to do - the entry is lost, the flow is not */
      }
    }

    trackEvent('onboarding_complete', {
      instrument,
      struggle: primaryStruggle,
      struggles: struggles.length,
      wroteEntry: !!entry,
    });
    await markOnboardingComplete();
    await onComplete();
  };

  const profileIndex = typeof step === 'object' ? step.profile : null;

  return (
    <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center px-5 py-10">
      <div className={step === 'plan' || step === 'entry' ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        <AnimatePresence mode="wait">
          <motion.div
            key={typeof step === 'object' ? `profile-${step.profile}` : step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/*
              The reaffirm screen.

              It asks for nothing. Several of the best flows studied open by
              confirming the decision somebody just made rather than
              immediately extracting from them, and it costs one tap at the
              point in the funnel where intent is the highest it will ever be.
            */}
            {step === 'welcome' && (
              <div className="text-center">
                <MascotSays pose="wave" height={92} side="above" className="mb-7">
                  Good call. Let&rsquo;s find out what&rsquo;s actually costing you.
                </MascotSays>
                <h1 className="text-[27px] sm:text-[33px] leading-[1.13] font-semibold
                  tracking-[-0.035em] text-white text-balance mb-3">
                  Nobody blows an account on the strategy.
                </h1>
                <p className="text-[14.5px] sm:text-[15.5px] leading-relaxed text-gray-400
                  max-w-md mx-auto">
                  You already know what a good trade looks like. What costs you money is the
                  distance between knowing it and doing it with real money on the line &mdash;
                  the <strong className="font-semibold text-white">identity-to-execution
                  gap</strong>. Eight questions and I&rsquo;ll show you where yours is.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('onboarding_started');
                    setStep('instrument');
                  }}
                  className="mt-7 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Start
                  <ArrowRight size={17} />
                </button>
                <p className="mt-3 text-[12.5px] text-gray-500">Takes about a minute</p>
              </div>
            )}

            {step === 'instrument' && (
              <Question
                step={step}
                title="What do you trade?"
                options={INSTRUMENTS}
                onChoose={answerInstrument}
              />
            )}

            {step === 'experience' && (
              <Question
                step={step}
                title="How long have you been at it?"
                options={EXPERIENCE}
                onChoose={answerExperience}
              />
            )}

            {/*
              Multi-select, and the only question screen with a confirm
              button.

              Headspace found that letting people pick more than one goal
              lifted trial conversion 10%, and the honest answer here is
              usually more than one - somebody revenge trading after a loss
              is generally overtrading as well. The second tap is the price
              of not forcing a false choice, and it buys a better answer.
            */}
            {step === 'struggles' && (
              <>
                <Progress step={step} />
                <h1 className="text-[26px] sm:text-[32px] leading-[1.15] font-semibold
                  tracking-[-0.03em] text-white text-balance text-center mb-2">
                  What&rsquo;s actually costing you money?
                </h1>
                <p className="text-center text-[13.5px] text-gray-500 mb-6">
                  Pick as many as are true.
                </p>
                <div className="flex flex-col gap-2.5">
                  {STRUGGLES.map((o) => (
                    <Choice
                      key={o.value}
                      label={o.label}
                      selected={struggles.includes(o.value)}
                      onClick={() => toggleStruggle(o.value)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={struggles.length === 0}
                  onClick={confirmStruggles}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              </>
            )}

            {profileIndex !== null && (
              <Question
                step={step}
                title={PROFILE_QUESTIONS[profileIndex].title}
                options={PROFILE_QUESTIONS[profileIndex].options}
                onChoose={(v) => answerProfile(profileIndex, v)}
              />
            )}

            {step === 'thinking' && <Thinking onDone={() => setStep('plan')} />}

            {step === 'entry' && (
              <FirstEntry onDone={(entry, transcript) => void finish(entry, transcript)} />
            )}

            {step === 'plan' && (
              <>
                <h1 className="text-[27px] sm:text-[34px] leading-[1.12] font-semibold
                  tracking-[-0.038em] text-white text-center mb-3">
                  {plan.headline}
                </h1>
                <p className="text-center text-[14.5px] sm:text-[15.5px] text-gray-300
                  leading-relaxed max-w-lg mx-auto">
                  {card.outcome}
                </p>

                {/*
                  The outcome, and the only place it is sold.

                  An earlier draft of this screen was all mechanism - a
                  rule-adherence number, a psychology score - and no
                  destination. Nobody signs up for a number. What is being
                  sold is the gap closing: the same strategy, run by somebody
                  who can see themselves running it.

                  The claim is deliberately about TIME rather than money.
                  "Three years compressed into two weeks" is a claim about
                  the speed of self-knowledge, which this can stand behind;
                  anything about returns is one it cannot, and this is a
                  trading product with a risk disclaimer for a reason.
                */}
                <div className="mt-6 sm:mt-7 text-center max-w-lg mx-auto">
                  {/*
                    Base weight deliberately light. emphasise() renders its
                    marked runs semibold white, so a line that is already
                    semibold white has nothing left to emphasise with - the
                    first version of this bolded "three years" and "two
                    weeks" into text that was identical to them.
                  */}
                  <p className="text-[16.5px] sm:text-[18px] leading-[1.45] font-normal
                    tracking-[-0.015em] text-gray-400 text-balance">
                    {emphasise('Most traders take *three years* to find out what you are about to find out in *two weeks*.')}
                  </p>
                  <p className="mt-3 text-[13.5px] sm:text-[14.5px] leading-relaxed text-gray-400">
                    {emphasise('Not because they are slow. Because nobody is measuring the thing that actually decides it — *what you were like going in*. P&L only tells you what already happened.')}
                  </p>
                  <p className="mt-3 text-[13.5px] sm:text-[14.5px] leading-relaxed text-gray-400">
                    {emphasise('You do not need a new strategy. You need *the one you already have*, executed by someone who can see themselves doing it.')}
                  </p>
                </div>

                {/*
                  The dated promise and the three specifics under it.

                  Every line here traces back to something they answered two
                  screens ago. A plan assembled from somebody's answers that
                  could have been written for anybody is a product tour with
                  their name on it.
                */}
                <div className="mt-6 sm:mt-7 rounded-2xl border border-brand-blue/30
                  bg-brand-blue/[0.06] p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-blue-light mb-2.5">
                    Your first two weeks
                  </p>
                  <p className="text-[15px] sm:text-[16px] leading-[1.5] text-white mb-4">
                    {emphasise(plan.promise)}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {plan.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-300">
                        <Check size={15} className="flex-shrink-0 mt-[3px] text-brand-blue-light" strokeWidth={2.5} />
                        <span>{emphasise(point)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 pt-3.5 border-t border-brand-blue/20 text-[12.5px] text-gray-500">
                    First number you’ll see: {plan.firstNumber}
                  </p>
                </div>

                {/*
                  The differentiator, live, and the one thing on this screen
                  they can touch. Unanswered stays visible as its own state,
                  which is the whole design of the real control - "not rated"
                  is not the same as "rated low".
                */}
                <div className="mt-4 rounded-2xl border border-white/10 bg-brand-surface p-4 sm:p-5">
                  <div className="flex items-baseline justify-between mb-3.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-gray-600">
                      Before the trade
                    </p>
                    <p className="text-[11.5px] text-gray-500">Try it</p>
                  </div>
                  <PreTradeScales
                    values={demoScales}
                    onChange={(key, value) => setDemoScales((prev) => ({ ...prev, [key]: value }))}
                  />
                  <p className="mt-4 pt-3.5 border-t border-white/10 text-[13px]
                    leading-relaxed text-gray-300">
                    {Object.values(demoScales).filter((v) => v !== null && v !== undefined).length === 3
                      ? 'Three taps. Thirty of those and the pattern stops being an opinion.'
                      : 'Rate them the way you would before an entry.'}
                  </p>
                </div>

                <div className="mt-6 text-center">
                  {/*
                    The same words as the button on the screen this leads to,
                    so the two screens are one promise rather than two.

                    Duolingo found that changing a CTA from "Continue" to
                    "Commit to my goal" was a large win - the button as a
                    promise to yourself rather than a navigation label. Worth
                    testing here, but not worth breaking the match with the
                    paywall's own CTA on a guess.
                  */}
                  {/*
                    Leads to the demonstration rather than to the price.

                    The plan is the argument; the next screen is the proof,
                    and it is the only place in this flow where the product
                    actually runs. Sending somebody from a promise straight
                    to a paywall is what the old flow did.
                  */}
                  <button
                    type="button"
                    onClick={() => setStep('entry')}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full
                      bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
                  >
                    Try it on a real trade
                    <ArrowRight size={17} />
                  </button>
                  <p className="mt-3 text-[12.5px] text-gray-500">
                    Takes about thirty seconds
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
