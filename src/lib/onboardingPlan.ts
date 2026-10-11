import type { Struggle } from '../services/onboarding';

/*
  The questions that make somebody describe their own problem, and the plan
  built out of their answers.

  Both live here rather than in the page because they are content, and
  content gets rewritten. The page should not need touching to reword a
  question or reorder the set.

  WHY THIS EXISTS AT ALL

  762 people signed up in thirty days. 49 ever reached a card. The old
  onboarding was three taps - instrument, experience, struggle - and then a
  price, so almost nobody dropped out of it and almost nobody paid at the end
  of it. It was not failing to hold people. It was failing to make a case.

  Across 1,460 onboarding flows, the average app runs 25 screens, the longest
  category is finance, and several of the longest flows belong to the most
  successful apps. Length is not the cost people assume it is, as long as
  every screen is about the person answering. Three taps was not restraint,
  it was an absent argument.

  THE ORDER IS DELIBERATE

  Easiest first, hardest last. Once somebody has spent time on a flow they
  are measurably more willing to answer the uncomfortable question, so the
  one about the account they lost is at the bottom where it can be answered
  rather than at the top where it gets somebody to close the tab.
*/

export interface ProfileOption {
  value: string;
  label: string;
}

export interface ProfileQuestion {
  id: string;
  title: string;
  options: ProfileOption[];
}

/*
  Worded the way a trader would say it, not the way a product would.

  Every one of these is about the distance between what somebody knows and
  what they actually do, because that is what their own answers say the
  problem is: of the 400 people who have answered the struggle question,
  the largest group picked "breaking my own rules" and the second largest
  picked "no idea, that's the problem". Two thirds of this audience has an
  awareness problem rather than a strategy one.
*/
export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: 'rules_live',
    title: 'Where do your rules actually live?',
    options: [
      { value: 'written', label: 'Written down somewhere' },
      { value: 'head', label: 'In my head' },
      { value: 'none', label: 'I don’t really have a set' },
    ],
  },
  {
    id: 'green_day',
    title: 'You’re up on the day. What usually happens next?',
    options: [
      { value: 'stop', label: 'I stop. Day’s done.' },
      { value: 'keep_going', label: 'I keep going' },
      { value: 'depends', label: 'Depends how far up I am' },
    ],
  },
  {
    id: 'after_loss',
    title: 'Straight after a loss, the next position is…',
    options: [
      { value: 'same', label: 'The same size' },
      { value: 'bigger', label: 'Bigger. I want it back.' },
      { value: 'none', label: 'There isn’t one. I walk away.' },
    ],
  },
  {
    id: 'notice_when',
    title: 'When you break one of your own rules, when do you notice?',
    options: [
      { value: 'during', label: 'While I’m doing it' },
      { value: 'after', label: 'Right after I close it' },
      { value: 'later', label: 'Days later. If at all.' },
    ],
  },
  /*
    The hard one, and last on purpose.

    Every trader in this audience has lost an account - an evaluation or
    their own money, which is the same wound - and naming how is the moment
    the flow stops being a questionnaire. Asked third, it reads as intrusive.
    Asked last, after four answers they have already given, it reads as the
    obvious question.

    The third option exists so somebody who genuinely has not lost one is not
    forced to invent a defeat to get past the screen.
  */
  {
    id: 'what_ended_it',
    title: 'The last account you lost — what actually ended it?',
    options: [
      { value: 'one_day', label: 'One bad day' },
      { value: 'slow_bleed', label: 'A slow bleed over weeks' },
      { value: 'never', label: 'I haven’t lost one' },
    ],
  },
];

export type ProfileAnswers = Record<string, string>;

/*
  THE COMMITMENT: why, how long a day, and for how many days.

  Taken from Duolingo, which asks all three before a single lesson - why
  you are learning, how much time a day, and later a streak goal - and found
  the act of choosing is what does the work: its streak-goal test kept users
  better weeks later even though the app never used the number they picked,
  and a version with nothing preselected did better still. So nothing here is
  preselected either; each is one tap that advances on its own.

  WHY 7 / 14 / 30 / 66 DAYS AND NOT MONTHS

  A first goal has to be close enough to feel reachable. Duolingo's own
  streak goals stop at weeks, not months, and the best-known study of how
  long a habit takes to stick (Lally et al., 2010) put the median at 66
  days - with a range so wide that "three months" or "a year" would be a
  number nobody can picture hitting. 14 is marked recommended because it is
  exactly the free trial: the promise and the trial end on the same day,
  which is when they decide whether to pay. 66 is there for the ambitious,
  with the honest reason attached.

  Stored in onboarding_profile alongside the behavioural answers - keys
  goal, daily_minutes and commit_days - so this needed no migration.
*/
export interface ChoiceOption {
  value: string;
  label: string;
  /* Right-aligned word, Duolingo's Casual / Regular / Serious. */
  tag?: string;
  recommended?: boolean;
}

export const WHY_OPTIONS: ChoiceOption[] = [
  { value: 'pass_challenge', label: 'Pass a prop firm challenge' },
  { value: 'stop_blowing', label: 'Stop blowing accounts' },
  { value: 'consistent', label: 'Trade the same way every day' },
  { value: 'understand', label: 'Understand why I do what I do' },
];

/*
  WHY IT DID NOT STICK LAST TIME.

  The single most predictive thing about whether somebody keeps journaling
  is whether they already tried and stopped - and why. Asked straight after
  their goal, it makes them name the exact thing that beat them before, and
  the plan then answers that thing by name ("You said typing killed it.
  Here it is thirty seconds out loud"). Naming an obstacle and pairing it
  with a specific plan for it is the core of implementation-intention and
  mental-contrasting research (Gollwitzer; Oettingen's WOOP), which is the
  best-replicated finding on why some goals survive contact with real life.

  Two taps, not one: "have you?" and then, only for a yes, "why did you
  stop?" - Brandon's split. Asking the reason on its own screen makes it a
  question they have to actually answer rather than a clause they skim.

  Stored as onboarding_profile.past_journal: the reason, or 'never'.
*/
export const PAST_OPTIONS: ChoiceOption[] = [
  { value: 'yes', label: 'Yes, but I stopped' },
  { value: 'never', label: 'No, this is my first' },
];

/*
  "Stopped after a bad run" is the one specific to traders: people look away
  from their results exactly when they are losing - the ostrich effect,
  measured in how often investors check their portfolios in down markets
  (Karlsson, Loewenstein & Seppi). Which is precisely when a journal is
  worth most.
*/
export const STOPPED_OPTIONS: ChoiceOption[] = [
  { value: 'typing', label: 'It took too long to fill in' },
  { value: 'forgot', label: 'I kept forgetting' },
  { value: 'bad_run', label: 'I stopped during a bad run' },
  { value: 'no_point', label: 'I never saw what it was for' },
];

/* The plan's answer to whatever beat them last time. */
const PAST_ANSWER: Record<string, string> = {
  typing: 'You said filling it in killed it. Here a trade takes *thirty seconds, said out loud or typed messy*.',
  forgot: 'You said you kept forgetting. Your dashboard *counts every day toward your goal*, so a missed one shows.',
  no_point: 'You said you never saw what it was for. *Two numbers by the end of the trial* — that is what it is for.',
  bad_run: 'You said you stopped during a bad run. That is when it matters most — *three taps still works on your worst day*.',
  never: 'First journal? *One trade, thirty seconds* is the whole job on day one.',
};

export function pastAnswerLine(profile: ProfileAnswers): string | null {
  return PAST_ANSWER[profile.past_journal ?? ''] ?? null;
}

/*
  The lines on the "thinking" screen, built from what they said.

  It used to be three generic lines in 1.75 seconds - too fast to read, so
  it looked like a canned transition rather than work being done on their
  answers. Showing labour that is visibly about the person ("operational
  transparency", Buell & Norton, HBS) measurably raises how much people
  value the result, provided each step is believable. Every line here
  names something they actually answered.
*/
export function thinkingLines(struggles: string[], profile: ProfileAnswers): string[] {
  const primary = struggles[0] ?? 'not_sure';
  const struggleLine: Record<string, string> = {
    revenge_trading: 'Looking at what happens after a loss',
    overtrading: 'Checking what your quiet days have in common',
    breaking_rules: 'Finding which rules slip first',
    not_sure: 'Looking for the pattern you can’t see yet',
  };
  const pastLine: Record<string, string> = {
    typing: 'Cutting each entry down to thirty seconds',
    forgot: 'Setting up your daily count',
    no_point: 'Picking the two numbers you’ll see first',
    bad_run: 'Making it work on your worst days',
    never: 'Setting up your first journal',
  };
  return [
    'Reading your answers',
    struggleLine[primary] ?? struggleLine.not_sure,
    pastLine[profile.past_journal ?? ''] ?? 'Setting up your journal',
    'Building your starter checklist',
    profile.commit_days ? `Planning your first ${profile.commit_days} days` : 'Planning your first two weeks',
  ];
}

export const MINUTES_OPTIONS: ChoiceOption[] = [
  { value: '2', label: '2 minutes', tag: 'Quick' },
  { value: '5', label: '5 minutes', tag: 'Regular' },
  { value: '10', label: '10 minutes', tag: 'Serious' },
  { value: '15', label: '15 minutes', tag: 'All in' },
];

export const COMMIT_OPTIONS: ChoiceOption[] = [
  { value: '7', label: '7 days', tag: 'A start' },
  { value: '14', label: '14 days', tag: 'Recommended', recommended: true },
  { value: '30', label: '30 days', tag: 'Serious' },
  { value: '66', label: '66 days', tag: 'Habit-forming' },
];

const GOAL_PHRASE: Record<string, string> = {
  pass_challenge: 'to pass your challenge',
  stop_blowing: 'to stop blowing accounts',
  consistent: 'to trade the same way every day',
  understand: 'to see why you do what you do',
};

/* "14 trading days, 5 minutes each - to pass your challenge." Null until both numbers are picked. */
export function commitmentLine(profile: ProfileAnswers): string | null {
  const days = profile.commit_days;
  const minutes = profile.daily_minutes;
  if (!days || !minutes) return null;
  const why = GOAL_PHRASE[profile.goal ?? ''];
  return `*${days} trading days, ${minutes} minutes each*${why ? ` \u2014 ${why}` : ''}.`;
}

export interface Plan {
  /* The line that names their pattern back to them. */
  headline: string;
  /* The date the trial ends, already formatted. */
  day: string;
  /* What the first fortnight produces, as a quiet line under the headline. */
  promise: string;
  /* Three specifics, each traceable to something they answered. */
  points: string[];
  /* The first number this person will see, named from what they picked. */
  firstNumber: string;
}

const HEADLINE: Record<Struggle, string> = {
  revenge_trading: 'It’s the next trade that costs you.',
  overtrading: 'Your best days are your quietest.',
  breaking_rules: 'You keep every rule that costs you nothing.',
  not_sure: 'You have a pattern. You just haven’t seen it yet.',
};

/*
  The first number they will actually see, picked from what they said is
  costing them. Each one is computed from their own entries - adherence from
  the rules they tick, the psychology score from the pre-trade scales - so
  none of this promises that something will be noticed on their behalf.
*/
const FIRST_NUMBER: Record<Struggle, string> = {
  revenge_trading: 'your adherence on the trade straight after a loss',
  overtrading: 'your trade count against your P&L',
  breaking_rules: 'your rule adherence',
  not_sure: 'your psychology score',
};

/*
  The date is the point.

  The strongest flows in the Mobbin study do not just collect answers, they
  show what the answers unlocked and put a date on it - Speak tells you what
  you will be able to do in two months, Byte Pal names the day you hit your
  goal. The equivalent here is honest and still specific: a pattern needs
  entries before it exists, fourteen days produces enough of them, and that
  is a claim that can be stood behind.

  What it must never become is a prediction about money. This is a trading
  product; the outcome being sold is seeing yourself clearly, not a return.
*/
export function buildPlan(
  struggles: Struggle[],
  profile: ProfileAnswers,
  trialEnds: Date,
): Plan {
  const primary = struggles[0] ?? 'not_sure';
  const points: string[] = [];

  /*
    Each point quotes something they actually said back at them. A plan
    assembled from their answers that could have been written for anybody is
    just a product tour with their name on it.
  */
  if (profile.rules_live === 'head' || profile.rules_live === 'none') {
    points.push(
      'Your rules come out of your head and onto *a checklist you tick before entry*.',
    );
  } else {
    points.push(
      '*A checklist you tick before entry*, and every entry records which ones you kept.',
    );
  }

  if (profile.after_loss === 'bigger') {
    points.push(
      'Every trade scored against *what you were like going in* — starting with the ones after a loss.',
    );
  } else if (profile.green_day === 'keep_going') {
    points.push(
      'Every trade scored against *what you were like going in* — including the ones after the day was won.',
    );
  } else {
    points.push(
      'Every trade scored against *what you were like going in*, not just what it paid.',
    );
  }

  if (profile.notice_when === 'later') {
    points.push(
      '*Adherence, psychology and P&L on one screen* — the same week, not months later.',
    );
  } else {
    points.push(
      '*Adherence, psychology and P&L on one screen* — something you look at, not something you are told.',
    );
  }

  const day = trialEnds.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  /*
    "Enough" rather than a number of entries. We do not know how often they
    trade and inventing a figure here would put a made-up number on the
    screen immediately before a price, which is the worst possible place for
    one.
  */
  const promise = 'A *rule-adherence number* and a *psychology score*. Yours, not an average.';

  return {
    headline: HEADLINE[primary],
    day,
    promise,
    points,
    firstNumber: FIRST_NUMBER[primary],
  };
}
