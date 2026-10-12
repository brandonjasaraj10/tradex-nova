import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import {
  saveInstrument, saveExperience, saveStruggles, saveProfileAnswers,
  markOnboardingComplete,
  type Instrument, type Experience, type Struggle,
} from '../services/onboarding';
import { STRUGGLE_CARD } from '../lib/onboardingPreview';
import {
  PROFILE_QUESTIONS, buildPlan, type ProfileAnswers,
  WHY_OPTIONS, PAST_OPTIONS, STOPPED_OPTIONS, SWITCHING_OPTIONS, MINUTES_OPTIONS, COMMIT_OPTIONS, commitmentLine, pastAnswerLine,
  thinkingLines, type ChoiceOption,
} from '../lib/onboardingPlan';
import { trackEvent } from '../lib/productAnalytics';
import { emphasise } from '../lib/emphasise';
import MascotSays from '../components/shared/MascotSays';
import NovaClip from '../components/shared/NovaClip';
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
  | 'why'
  | 'past'
  | 'stopped'
  | 'switching'
  | 'instrument'
  | 'experience'
  | 'struggles'
  | { profile: number }
  | 'minutes'
  | 'commit'
  | 'thinking'
  | 'pattern'
  | 'gap'
  | 'plan'
  | 'planwhen'
  | 'planhow'
  | 'entry';

/* Why, what beat them before, three about them, the behavioural ones, then daily time and the goal. */
/* "Why did you stop" only appears after a yes; a no simply jumps the bar one step. */
const QUESTION_COUNT = 8 + PROFILE_QUESTIONS.length;

function questionIndex(step: Step): number | null {
  if (step === 'why') return 0;
  if (step === 'past') return 1;
  if (step === 'stopped' || step === 'switching') return 2;
  if (step === 'instrument') return 3;
  if (step === 'experience') return 4;
  if (step === 'struggles') return 5;
  if (typeof step === 'object') return 6 + step.profile;
  if (step === 'minutes') return 6 + PROFILE_QUESTIONS.length;
  if (step === 'commit') return 7 + PROFILE_QUESTIONS.length;
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

/*
  About a second a line - slow enough to read each one, which is the point:
  at 1.75 seconds for three generic lines it read as a loading flash, not as
  anything being worked out for them. See thinkingLines.
*/
const THINKING_STEP_MS = 1000;

function Thinking({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    /*
      One timer per line and one to finish, all cleared together - a step
      left behind mid-count must not advance the flow underneath whatever
      replaced it.
    */
    const timers = [
      ...lines.slice(1).map((_, i) => window.setTimeout(() => setLine(i + 1), (i + 1) * THINKING_STEP_MS)),
      /* A beat on the last tick before moving on, so it lands as finished. */
      window.setTimeout(() => setLine(lines.length), lines.length * THINKING_STEP_MS),
      window.setTimeout(onDone, lines.length * THINKING_STEP_MS + 600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone, lines]);

  return (
    <div className="flex flex-col items-center text-center">
      <MascotSays pose="lean" height={84} side="above" className="mb-7">
        Give me a second, I&rsquo;m putting this together.
      </MascotSays>

      <ul className="flex flex-col gap-3 w-full max-w-[280px]">
        {lines.map((text, i) => (
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
          className="h-full rounded-full bg-brand-blue-light shadow-[0_0_10px_rgba(96,165,250,0.8)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        />
      </div>
      {/*
        No "3 of 13". Brandon: the count made it feel like a test - every
        screen a reminder of how many were left. Duolingo shows only the bar,
        and the bar alone still says "you are moving" without the arithmetic.
      */}
    </div>
  );
}

/*
  NOVA ASKS THE QUESTION.

  Duolingo's onboarding never shows a form heading - Duo asks each question
  in a speech bubble, so a run of questions reads as a conversation with a
  character rather than a survey. Same here: Nova beside a bubble holding the
  question, the pose changing as it goes so it feels alive rather than
  pasted in.
*/

const GOAL_REPLY: Record<string, string> = {
  profitable: 'That’s exactly what this is built for.',
  pass_challenge: 'Good. Most challenges are lost to one habit. Let’s find yours.',
  stop_blowing: 'Then the next account is the one we protect.',
  consistent: 'Consistency is a habit. Habits can be tracked.',
  understand: 'That’s the right place to start.',
};

/*
  Replies with a projected result, the way Duo answers "5 min/day" with
  "That'd be 25 words in your first week!" - the choice they just made,
  turned into what it gets them.
*/
const MINUTES_REPLY: Record<string, string> = {
  '2': 'That’s enough to log every trade you take.',
  '5': 'That’s every trade logged and rated, every day.',
  '10': 'Room for a quick look back each day too.',
  '15': 'That’s a full daily review. Serious.',
};

const COMMIT_REPLY: Record<string, string> = {
  '7': 'One week. Enough for your first pattern to show.',
  '14': 'Two weeks, the same length as your free trial.',
  '30': 'A month. That’s when it turns into routine.',
  '66': 'Sixty-six days. That’s habit territory.',
};

const PAST_REPLY: Record<string, string> = {
  typing: 'Fair. Here it takes thirty seconds.',
  forgot: 'Then I’ll keep count for you.',
  bad_run: 'That’s exactly when it matters most.',
  no_point: 'You’ll see the point within a week.',
  switch_numbers: 'That’s the gap I fill.',
  switch_typing: 'Here it takes thirty seconds.',
  switch_insight: 'Naming it is my whole job.',
  switch_trying: 'Fair. Let me show you.',
};

/*
  Types the line in, a few characters at a time, the way Duo's bubble does -
  so the question arrives as something Nova is saying rather than a heading
  that was already there. Fast (about a second for a long question) and
  skipped entirely under reduced motion.
*/
function useTyped(text: string) {
  const [shown, setShown] = useState(text);
  /* 'dots' while Nova is "typing", 'typing' while the words come in, then 'done'. */
  const [phase, setPhase] = useState<'dots' | 'typing' | 'done'>('done');
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      setPhase('done');
      return;
    }
    setShown('');
    setPhase('dots');
    let i = 0;
    let id = 0;
    const startTyping = window.setTimeout(() => {
      setPhase('typing');
      id = window.setInterval(() => {
        i += 2;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(id);
          setPhase('done');
        }
      }, 22);
    }, 380);
    return () => {
      window.clearTimeout(startTyping);
      window.clearInterval(id);
    };
  }, [text]);
  return { shown, phase };
}

/*
  Nova and the bubble STAY on screen between questions - only the words in
  the bubble and the answers underneath change. Duolingo keeps Duo in place
  for the whole run of questions, and it is a large part of why theirs feels
  like one conversation instead of a stack of screens: nothing jumps, the
  same character is still there, it just says the next thing. A very slow
  float keeps him from looking pasted in without anything moving that the
  eye has to follow.
*/
function Ask({ step, title, subtitle, reacting = false }: { step: Step; title: string; subtitle?: string; reacting?: boolean }) {
  const index = questionIndex(step) ?? 0;
  const { shown: typed, phase } = useTyped(title);

  /*
    NOVA IS ANIMATED, THE SCREEN IS NOT.

    The page transitions that slid whole screens sideways gave Brandon a
    headache; a character moving is a different thing, and it is most of
    what makes Duo feel alive. So the motion is Nova's alone:

    - each new question, the idle clip plays once (breathes, blinks, tilts)
      and he settles with a small spring - then holds still, the way Duo does,
      rather than looping;
    - while the words type, a small talking bob;
    - when he answers back, the nod clip plays once, he bounces gently, and
      two soft blue rings spread from his head - "heard you" - slowly enough
      to see.

    Both clips are mounted together and swapped by opacity, so switching to
    the nod never flashes a still pose in between.
  */
  const body = useAnimationControls();
  useEffect(() => {
    if (reacting) {
      void body.start({ y: [0, -10, 0, -4, 0], rotate: [0, 3, 0, 1.5, 0], transition: { duration: 1.1, ease: 'easeOut' } });
    } else {
      void body.start({ y: [5, 0], scale: [0.96, 1], transition: { type: 'spring', stiffness: 260, damping: 16 } });
    }
  }, [index, reacting, body]);

  return (
    <>
      <Progress step={step} />
      <div className="flex items-start gap-3 mb-6">
        <div className="relative flex-shrink-0">
          <motion.div
            className="origin-bottom"
            animate={phase === 'typing' ? { y: [0, -2, 0] } : { y: 0 }}
            transition={phase === 'typing' ? { duration: 0.3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          >
            <motion.div animate={body} className="relative origin-bottom">
              <div className={`transition-opacity duration-200 ${reacting ? 'opacity-0' : 'opacity-100'}`}>
                <NovaClip clip="idle" height={96} playKey={index} />
              </div>
              <div className={`absolute inset-0 transition-opacity duration-200 ${reacting ? 'opacity-100' : 'opacity-0'}`}>
                <NovaClip clip="nod" height={96} playKey={reacting ? `r-${index}` : undefined} />
              </div>
            </motion.div>
          </motion.div>
          {reacting && [0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute left-1/2 top-[22%] -ml-5 w-10 h-10 rounded-full border-2 border-brand-blue-light/60 pointer-events-none"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 2.1], opacity: [0.8, 0] }}
              transition={{ duration: 1.4, delay: 0.15 + i * 0.35, ease: 'easeOut' }}
            />
          ))}
        </div>

        {/*
          A fixed-size bubble. It used to size itself to each question, so it
          grew and shrank from one question to the next and read as jumpy.
          Now every bubble is the same box and the words fill it.
        */}
        <div className="relative mt-2 flex-1 min-h-[108px] rounded-2xl border border-white/10 bg-brand-elevated px-4 py-3">
          <p className="text-[16px] sm:text-[18px] leading-snug font-semibold text-white" aria-hidden="true">
            {phase === 'dots' ? (
              <span className="inline-flex items-center gap-1 h-[1.4em]">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </span>
            ) : (
              typed
            )}
          </p>
          <span className="sr-only">{title}</span>
          {subtitle && <p className="mt-1.5 text-[12.5px] text-gray-500">{subtitle}</p>}
          <span
            aria-hidden="true"
            className="absolute -left-[6px] top-8 w-3 h-3 rotate-45 bg-brand-elevated border-l border-b border-white/10"
          />
        </div>
      </div>
    </>
  );
}

/*
  One tap, full width, generous target.

  These are read on a phone by somebody who has just typed a password, so the
  rows are large and there is nothing else on screen to hit by mistake.
*/
function Choice({
  label, onClick, selected = false, tag, recommended = false,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  tag?: string;
  recommended?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      animate={selected ? { scale: [1, 1.015, 1] } : undefined}
      transition={{ duration: 0.22 }}
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
      {!selected && tag && (
        <span className={`text-[12px] ${recommended ? 'text-brand-blue-light' : 'text-gray-500'}`}>{tag}</span>
      )}
    </motion.button>
  );
}

function Question({
  title, subtitle, options, onChoose,
}: {
  step: Step;
  title: string;
  subtitle?: string;
  options: ChoiceOption[];
  onChoose: (value: string) => void;
}) {
  /*
    The tapped answer lights up and ticks before the screen moves on.

    It used to jump the instant it was touched, so the tap had no visible
    result of its own - the screen just changed. Duolingo confirms every
    answer before moving, and a quarter of a second of "yes, that one" is
    what makes a run of questions feel like it is responding to you rather
    than flicking past. A short haptic tick where the phone supports it.
  */
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (value: string) => {
    if (picked) return;
    setPicked(value);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* no haptics here */
    }
    window.setTimeout(() => onChoose(value), 260);
  };

  return (
    <>
      {/* The question itself is said by Nova in the header above, which stays put. */}
      <div className="flex flex-col gap-2.5" aria-label={subtitle ? `${title} ${subtitle}` : title}>
        {options.map((o, i) => (
          <motion.div
            key={o.value}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + i * 0.05, duration: 0.2, ease: 'easeOut' }}
          >
            <Choice label={o.label} tag={o.tag} recommended={o.recommended} selected={picked === o.value} onClick={() => choose(o.value)} />
          </motion.div>
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
  /* Computed once the answers are in; stable so the thinking timers are not reset by a re-render. */
  const thinkLines = useMemo(() => thinkingLines(struggles, profile), [struggles, profile]);
  const goToPattern = useCallback(() => setStep('pattern'), []);
  const card = STRUGGLE_CARD[primaryStruggle];

  /*
    The commitment answers live in the same profile object as the
    behavioural ones - see the note on WHY_OPTIONS - and are written with it.
  */
  /*
    NOVA ANSWERS BACK, ON THE TWO QUESTIONS THAT ARE ABOUT THEM.

    Duolingo has Duo reply to "why are you learning?" with a line that
    affirms that specific reason before moving on - the moment the flow
    stops feeling like a form. Same here, for their goal and for why their
    last journal did not stick: the bubble says something back to the
    answer for a beat, then the next question types in.
  */
  const [reply, setReply] = useState<string | null>(null);
  const replyThen = (line: string | undefined, next: () => void) => {
    if (!line) return next();
    setReply(line);
    window.setTimeout(() => {
      setReply(null);
      next();
    }, 2200); /* ~1s for the dots and typing, ~1s to actually read it */
  };

  const answerWhy = (value: string) => {
    setProfile((prev) => ({ ...prev, goal: value }));
    trackEvent('onboarding_goal', { goal: value });
    replyThen(GOAL_REPLY[value], () => setStep('past'));
  };

  const answerPast = (value: string) => {
    trackEvent('onboarding_past_journal', { past: value });
    if (value === 'stopped' || value === 'current') {
      setStep(value === 'stopped' ? 'stopped' : 'switching');
      return;
    }
    setProfile((prev) => ({ ...prev, past_journal: value }));
    setStep('instrument');
  };

  const answerStopped = (value: string) => {
    setProfile((prev) => ({ ...prev, past_journal: value }));
    trackEvent('onboarding_stopped_why', { reason: value });
    replyThen(PAST_REPLY[value], () => setStep('instrument'));
  };

  /* What Nova is asking on the current screen, for the header that stays put. */
  const ask: { title: string; subtitle?: string } | null =
    step === 'why' ? { title: 'What do you want journaling to get you?' }
    : step === 'past' ? { title: 'Have you kept a trading journal before?' }
    : step === 'switching' ? { title: 'What’s your current one missing?', subtitle: 'Your plan is built around the answer.' }
    : step === 'stopped' ? { title: 'Why did you stop?', subtitle: 'Be honest — your plan is built around it.' }
    : step === 'instrument' ? { title: 'What do you trade?' }
    : step === 'experience' ? { title: 'How long have you been at it?' }
    : step === 'struggles' ? { title: 'What’s actually costing you money?', subtitle: 'Pick as many as are true.' }
    : typeof step === 'object' ? { title: PROFILE_QUESTIONS[step.profile].title }
    : step === 'minutes' ? { title: 'How long can you give it on a trading day?', subtitle: 'One trade takes about thirty seconds. The rest is looking back.' }
    : step === 'commit' ? { title: 'Pick your first goal.', subtitle: 'Journal every trading day for…' }
    : null;

  const answerMinutes = (value: string) => {
    setProfile((prev) => ({ ...prev, daily_minutes: value }));
    trackEvent('onboarding_daily_minutes', { minutes: Number(value) });
    replyThen(MINUTES_REPLY[value], () => setStep('commit'));
  };

  const answerCommit = (value: string) => {
    const next: ProfileAnswers = { ...profile, commit_days: value };
    setProfile(next);
    void saveProfileAnswers(next);
    trackEvent('onboarding_commit', { days: Number(value), minutes: Number(next.daily_minutes ?? 0) });
    replyThen(COMMIT_REPLY[value], () => setStep('thinking'));
  };

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
    setStep('minutes');
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
    /*
      Exactly the visible screen, not 100vh.

      min-h-screen is 100vh, which on an iPhone includes the strip behind
      Safari's address bar - so every screen, however short, was a few dozen
      pixels taller than what could be seen and scrolled. 100dvh is the
      height actually visible. Screens that fit sit centred and still; the
      one or two that genuinely need more (the written entry) still scroll.
    */
    <div className="min-h-[100dvh] bg-brand-bg text-white flex items-center justify-center px-5 py-6 sm:py-10">
      <div className={step === 'entry' ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        {/* Outside the transition, so Nova and the bubble stay still while the answers change. */}
        {ask && <Ask step={step} title={reply ?? ask.title} subtitle={reply ? undefined : ask.subtitle} reacting={!!reply} />}

        <AnimatePresence mode="wait">
          <motion.div
            key={typeof step === 'object' ? `profile-${step.profile}` : step}
            /*
              A plain, quick fade. A sideways slide was tried and gave Brandon
              a headache going through thirty screens of it - nothing should
              move that does not need to.
            */
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
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
                  <MascotSays key="m" pose="wave" clip="wave" height={110} side="above" className="mb-7">
                    {/* Nova introduces himself and says how short it is, the way Duo opens with "Just 7 quick questions". */}
                    {firstName ? `Hey ${firstName}, I\u2019m Nova. A minute of quick taps and I\u2019ll build your plan.`
                               : 'Hey, I\u2019m Nova. A minute of quick taps and I\u2019ll build your plan.'}
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
                    <p className="mt-3 text-[12.5px] text-gray-500">About a minute of taps</p>
                  </div>,
                ].map((node, i) => (
                  <div
                    key={i}
                    className="transition-all duration-500 ease-out"
                    style={{
                      opacity: revealed ? 1 : 0,
                      /* Fade only. A rise from below read as text sliding up out of the middle of the screen, half cut off. */
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
                  onClick={() => setStep('why')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Find mine
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {/*
              Duolingo's first question is why you are learning. Asked here,
              before anything about their trading, it frames the rest of the
              flow as being about something they want rather than something
              wrong with them.
            */}
            {step === 'why' && (
              <Question
                step={step}
                title="What do you want journaling to get you?"
                options={WHY_OPTIONS}
                onChoose={answerWhy}
              />
            )}

            {step === 'past' && (
              <Question
                step={step}
                title="Have you kept a trading journal before?"
                options={PAST_OPTIONS}
                onChoose={answerPast}
              />
            )}

            {step === 'switching' && (
              <Question
                step={step}
                title="What’s your current one missing?"
                subtitle="Your plan is built around the answer."
                options={SWITCHING_OPTIONS}
                onChoose={answerStopped}
              />
            )}

            {step === 'stopped' && (
              <Question
                step={step}
                title="Why did you stop?"
                subtitle="Be honest — your plan is built around it."
                options={STOPPED_OPTIONS}
                onChoose={answerStopped}
              />
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

            {step === 'minutes' && (
              <Question
                step={step}
                title="How long can you give it on a trading day?"
                subtitle="One trade takes about thirty seconds. The rest is looking back."
                options={MINUTES_OPTIONS}
                onChoose={answerMinutes}
              />
            )}

            {/* Nothing preselected - choosing it is the point. See COMMIT_OPTIONS. */}
            {step === 'commit' && (
              <Question
                step={step}
                title="Pick your first goal."
                subtitle="Journal every trading day for…"
                options={COMMIT_OPTIONS}
                onChoose={answerCommit}
              />
            )}

            {step === 'thinking' && <Thinking lines={thinkLines} onDone={goToPattern} />}

            {step === 'entry' && (
              <FirstEntry
                rules={starterRules}
                psychChecks={starterChecks}
                goalDays={Number(profile.commit_days) || null}
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
                  {emphasise(`Most traders take *three years* to find out what you are about to find out in *${profile.commit_days ? `${profile.commit_days} trading days` : 'two weeks'}*.`)}
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-blue-400 mb-5">
                  {plan.eyebrow}
                </p>

                <h1 className="text-[27px] sm:text-[34px] leading-[1.13] font-semibold
                  tracking-[-0.038em] text-white text-balance">
                  {plan.title}
                </h1>

                {/*
                  Their own goal, handed back in their own numbers, above the
                  three points - the line that turns a plan written for them
                  into one they agreed to.
                */}
                {commitmentLine(profile) && (
                  <p className="mt-7 mx-auto max-w-sm rounded-xl border border-brand-blue-light/25
                    bg-brand-blue/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-gray-300">
                    <span className="block text-[10.5px] uppercase tracking-[0.14em] text-brand-blue-light mb-1">
                      Your goal
                    </span>
                    {emphasise(commitmentLine(profile)!)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setStep('planwhen')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {/*
              The plan, three screens of one idea each - Brandon found the
              single plan screen too heavy on his phone. Here: the date and
              what they will know by it, and the line answering why their last
              journal failed them.
            */}
            {step === 'planwhen' && (
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-blue-400 mb-5">
                  By {plan.day}
                </p>
                <p className="text-[22px] sm:text-[27px] leading-[1.3] font-semibold tracking-[-0.03em]
                  text-white text-balance max-w-sm mx-auto">
                  {emphasise(plan.promise.replace(/^By \*[^*]+\* /, '').replace(/^./, (c) => c.toUpperCase()))}
                </p>
                {pastAnswerLine(profile) && (
                  <p className="mt-7 mx-auto max-w-sm rounded-xl border border-brand-blue-light/25
                    bg-brand-blue/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-gray-300">
                    {emphasise(pastAnswerLine(profile)!)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setStep('planhow')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[15px] font-medium
                    hover:bg-gray-200 transition-colors"
                >
                  How I get there
                  <ArrowRight size={17} />
                </button>
              </div>
            )}

            {/*
              The plan's "how", on its own screen.

              It was the bottom half of the plan screen - 716px tall on a
              390px phone, so it scrolled on every iPhone. Split in two, each
              half fits and each has one job: the outcome and their goal,
              then what changes from the next trade.
            */}
            {step === 'planhow' && (
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-blue-400 mb-5">
                  How you get there
                </p>
                <h1 className="text-[26px] sm:text-[32px] leading-[1.14] font-semibold
                  tracking-[-0.035em] text-white text-balance">
                  Three things change from your next trade.
                </h1>
                <ul className="mt-7 flex flex-col gap-3 max-w-sm mx-auto text-left">
                  {plan.points.map((point, i) => (
                    <motion.li
                      key={point}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
                      className="flex gap-3 rounded-xl border border-white/[0.08] bg-brand-surface px-4 py-3
                        text-[13.5px] leading-snug text-gray-400"
                    >
                      <Check size={16} className="flex-shrink-0 mt-[1px] text-blue-400" strokeWidth={2.5} />
                      <span>{emphasise(point)}</span>
                    </motion.li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5
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
