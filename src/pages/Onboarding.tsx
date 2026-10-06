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
import { HELD_KEY } from '../services/onboardingWriteBack';
import FirstEntry from '../components/onboarding/FirstEntry';
import { buildStarterRules, buildStarterPsychChecks } from '../lib/onboardingChecklist';
import type { VoiceJournalData } from '../services/voiceJournal';

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
  | 'thegap'
  | 'instrument'
  | 'experience'
  | 'struggles'
  | { profile: number }
  | 'thinking'
  | 'pattern'
  | 'gap'
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

export default function Onboarding({
  onComplete,
  firstName,
}: {
  onComplete: () => void | Promise<void>;
  /*
    They typed this one screen ago. Opening on it is what makes this read as
    the next step of something rather than as a different app starting.
  */
  firstName?: string | null;
}) {
  const [step, setStep] = useState<Step>('welcome');

  /*
    Drives the welcome screen's staged reveal.

    Done with a CSS transition off a mounted flag rather than with framer's
    initial/animate, deliberately. An entrance that starts at opacity 0 and
    relies on an animation to bring it up leaves the first screen a new user
    ever sees completely blank if that animation does not run - which is
    exactly the failure that had to be fixed on the dashboard. Here the
    resting state is visible and the transition only moves it there, so the
    worst case is that it appears instantly.
  */
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 60);
    return () => clearTimeout(t);
  }, []);
  const [instrument, setInstrument] = useState<Instrument>('forex');
  const [struggles, setStruggles] = useState<Struggle[]>([]);
  const [profile, setProfile] = useState<ProfileAnswers>({});

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

  /*
    Their first checklist, built from the eight answers rather than described
    to them. A new account has none of these - inserting into trading_rules
    needs an active subscription - so without this the plan screen promises a
    checklist that does not exist and the app opens on empty panels.
  */
  const starterRules = useMemo(
    () => buildStarterRules(struggles, profile),
    [struggles, profile],
  );
  const starterChecks = useMemo(
    () => buildStarterPsychChecks(struggles, profile),
    [struggles, profile],
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
      Stashed here instead; onboardingWriteBack writes it the first time a
      protected page confirms they have access.

      Wrapped, because storage throws outright in some privacy modes and in
      embedded browsers - which is most of this traffic - and losing a
      stashed entry must never cost somebody the end of their signup.
    */
    if (entry) {
      try {
        localStorage.setItem(
          HELD_KEY,
          JSON.stringify({
            entry,
            transcript,
            /*
              The checklist goes with it. These are not rows yet and cannot
              be until there is a subscription, so the whole set - entry,
              rules, pre-trade checks - is written together afterwards.
            */
            rules: starterRules,
            psychChecks: starterChecks,
            at: Date.now(),
          }),
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
      <div className={step === 'entry' ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
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
                {[
                  <MascotSays key="m" pose="wave" height={92} side="above" className="mb-7">
                    {firstName ? `Right, ${firstName}. Let\u2019s find out what\u2019s costing you.`
                               : 'Let\u2019s find out what\u2019s actually costing you.'}
                  </MascotSays>,
                  /*
                    The same sentence the landing page opens with, and for the
                    same reason it was changed there: "Nobody blows an account
                    on the strategy" is not true of everybody - a weak edge
                    empties an account on its own - and somebody who suspects
                    theirs is the problem reads it as a lie. This is about the
                    person answering instead, which is both true and the
                    flattering half.

                    A plain comment rather than a JSX one, because these are
                    elements of an array and the braced JSX comment form is
                    only valid inside JSX itself.
                  */
                  <h1 key="h" className="text-[27px] sm:text-[33px] leading-[1.13] font-semibold
                    tracking-[-0.035em] text-white text-balance mb-3">
                    You already know what a good trade looks like.
                  </h1>,
                  <div key="b" className="mt-7">
                    <button
                      type="button"
                      onClick={() => {
                        trackEvent('onboarding_started');
                        setStep('thegap');
                      }}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5
                        rounded-full bg-white text-black text-[15px] font-medium
                        hover:bg-gray-200 transition-colors"
                    >
                      Show me
                      <ArrowRight size={17} />
                    </button>
                    <p className="mt-3 text-[12.5px] text-gray-500">Eight questions &middot; about a minute</p>
                  </div>,
                ].map((node, i) => (
                  <div
                    key={i}
                    className="transition-all duration-500 ease-out"
                    style={{
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? 'none' : 'translateY(10px)',
                      transitionDelay: `${i * 140}ms`,
                    }}
                  >
                    {node}
                  </div>
                ))}
              </div>
            )}

            {/*
              The belief change, given a screen and a picture rather than a
              clause.

              It was the tail of a paragraph on the welcome screen - "the
              distance between knowing what a good trade looks like and doing
              it with money on the line - the identity-to-execution gap" -
              which is the single most important idea in the product buried
              in the fourth line of the third sentence, hyphenated across two
              lines on a phone. Named, spaced and drawn, it is the only thing
              on screen and the gap is literally visible between the two
              words.
            */}
            {step === 'thegap' && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 sm:gap-5 mb-8">
                  <span className="text-[19px] sm:text-[25px] font-semibold tracking-[-0.03em] text-white">
                    Identity
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-600" aria-label="to">
                    <span className="block w-10 sm:w-16 border-t border-dashed border-white/25" />
                    <ArrowRight size={16} className="-ml-2.5" />
                  </span>
                  <span className="text-[19px] sm:text-[25px] font-semibold tracking-[-0.03em] text-white">
                    Execution
                  </span>
                </div>

                <p className="text-[16px] sm:text-[19px] leading-[1.4] text-gray-300 text-balance
                  max-w-sm mx-auto">
                  Every account you have lost died in that gap. Not in the strategy.
                </p>

                <button
                  type="button"
                  onClick={() => setStep('instrument')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Find mine
                  <ArrowRight size={17} />
                </button>
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

            {step === 'thinking' && <Thinking onDone={() => setStep('pattern')} />}

            {step === 'entry' && (
              <FirstEntry
                rules={starterRules}
                psychChecks={starterChecks}
                onDone={(entry, transcript) => void finish(entry, transcript)}
              />
            )}

            {/*
              The argument, split across three screens instead of stacked on
              one.

              It was 256 words on a single page, sitting between eight
              eleven-word question screens. That is the exact mistake the
              research warns about from the other direction: the average app
              in the Mobbin study runs 25 screens and Duolingo runs 60, and
              none of them feel long because each screen carries one idea.
              Length is cheap; density is not. Splitting a single signup form
              across several screens measurably raised conversion for House,
              which is the same trade being made here.
            */}
            {step === 'pattern' && (
              <div className="text-center">
                <h1 className="text-[28px] sm:text-[36px] leading-[1.1] font-semibold
                  tracking-[-0.04em] text-white text-balance mb-4">
                  {plan.headline}
                </h1>
                <p className="text-[15px] sm:text-[16.5px] text-gray-300 leading-relaxed
                  max-w-md mx-auto">
                  {card.outcome}
                </p>
                <button
                  type="button"
                  onClick={() => setStep('gap')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Go on
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {step === 'gap' && (
              <div className="text-center">
                <p className="text-[19px] sm:text-[23px] leading-[1.3] font-normal
                  tracking-[-0.02em] text-gray-400 text-balance max-w-lg mx-auto">
                  {emphasise('Most traders take *three years* to find out what you are about to find out in *two weeks*.')}
                </p>
                <p className="mt-6 text-[14px] sm:text-[15px] leading-relaxed text-gray-500
                  max-w-md mx-auto">
                  {emphasise('Nobody is measuring the thing that actually decides it \u2014 *what you were like going in*. P&L only tells you what already happened.')}
                </p>
                <button
                  type="button"
                  onClick={() => setStep('plan')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  So what changes
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {/*
              Quiet, like the two screens before it.

              This was a bordered blue card with ticked bullets sitting under
              a headline - the only panel in a flow that is otherwise black
              space and one sentence, and it read as a different product. The
              content has not changed; the furniture has gone. Three
              personalised lines, set small and grey, under one statement.
            */}
            {step === 'plan' && (
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-600 mb-5">
                  Your first two weeks
                </p>

                <h1 className="text-[27px] sm:text-[34px] leading-[1.13] font-semibold
                  tracking-[-0.038em] text-white text-balance">
                  By {plan.day} you&rsquo;ll have two numbers.
                </h1>

                <p className="mt-4 text-[15px] sm:text-[16.5px] leading-relaxed text-gray-300
                  max-w-sm mx-auto">
                  {emphasise(plan.promise)}
                </p>

                <div className="mt-9 flex flex-col gap-3.5 max-w-sm mx-auto">
                  {plan.points.map((point) => (
                    <p key={point} className="text-[13px] leading-relaxed text-gray-500">
                      {emphasise(point)}
                    </p>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="mt-9 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Try it on a real trade
                  <ArrowRight size={17} />
                </button>
                <p className="mt-3 text-[12.5px] text-gray-500">Takes about thirty seconds</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
