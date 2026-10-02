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

export interface Plan {
  /* The line that names their pattern back to them. */
  headline: string;
  /* What the first fortnight actually produces. One honest sentence. */
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
      'Your rules come out of your head and onto *a checklist you tick before you enter* — so breaking one is a thing you see, not a thing you remember.',
    );
  } else {
    points.push(
      'Your rules go on *a checklist you tick before you enter*, and every entry records which ones you actually kept.',
    );
  }

  if (profile.after_loss === 'bigger') {
    points.push(
      'Every trade is scored against *what you were like before you took it* — starting with the ones straight after a loss, since that is where you said the size goes up.',
    );
  } else if (profile.green_day === 'keep_going') {
    points.push(
      'Every trade is scored against *what you were like before you took it* — including the ones you take when the day was already won.',
    );
  } else {
    points.push(
      'Every trade is scored against *what you were like before you took it*, not just what it paid.',
    );
  }

  if (profile.notice_when === 'later') {
    points.push(
      '*Adherence, psychology and P&L on one screen* — so you see it the same week instead of months later, if at all.',
    );
  } else {
    points.push(
      '*Adherence, psychology and P&L on one screen* — the pattern is something you look at, not something you are told.',
    );
  }

  const day = trialEnds.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  /*
    "Enough" rather than a number of entries. We do not know how often they
    trade and inventing a figure here would put a made-up number on the
    screen immediately before a price, which is the worst possible place for
    one.
  */
  const promise = `By ${day} you’ll have a *rule-adherence number* and a *psychology score* with two weeks behind them. Yours, not an average.`;

  return {
    headline: HEADLINE[primary],
    promise,
    points,
    firstNumber: FIRST_NUMBER[primary],
  };
}
