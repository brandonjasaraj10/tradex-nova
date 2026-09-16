/*
  The free psychology audit: what it asks, and what it tells people.

  Two decisions shape everything in this file, and both come from what
  converts rather than from taste.

  First, the result is an ARCHETYPE, not a score. "You scored 73%" gets
  closed; "you're the one who doubles down after a loss" gets screenshotted,
  and identity-led results measurably beat score-led ones on both email
  capture and sharing. That matters twice over for traffic arriving from
  Instagram, where a screenshot is distribution back to the source.

  Second, the five archetypes are five DIFFERENT MOMENTS in a trade, not
  five degrees of the same failing. Psychology breaks at a particular point
  - before the entry, during the trade, after a loss, after a win, or in the
  absence of a setup - and a trader recognises the moment before they
  recognise the label. It also makes the questions honest: each one asks
  about a moment rather than about character.

  Deliberately NOT the same as the three signup questions. Those are triage
  for somebody who has already bought in: fast, blunt, four options. This is
  a diagnosis for a stranger who owes us nothing, so it is longer, the
  wording is theirs rather than ours, and the payoff is a verdict about who
  they are instead of a filter for what to show them.
*/

export type Archetype =
  | 'revenge'
  | 'hesitator'
  | 'rule_breaker'
  | 'giver_backer'
  | 'overtrader';

export interface Question {
  id: string;
  /* Asked about a moment, in the words a trader would use about it. */
  prompt: string;
  options: {
    label: string;
    /* Which archetypes this answer argues for, and how strongly. */
    weights: Partial<Record<Archetype, number>>;
  }[];
}

/*
  Six questions, one per screen.

  Five to ten is the researched range; six covers all five archetypes with
  at least two chances to score each, which stops one unlucky answer
  deciding the outcome. Every question has a genuinely healthy option, so
  the quiz can return a weak signal rather than forcing a diagnosis onto
  somebody who does not have one.
*/
export const QUESTIONS: Question[] = [
  {
    id: 'after_loss',
    prompt: 'You just got stopped out. What actually happens next?',
    options: [
      { label: "I'm looking for the next setup within minutes", weights: { revenge: 3, overtrader: 1 } },
      { label: 'I take the same trade again, usually bigger', weights: { revenge: 4 } },
      { label: 'I stop for a bit, then come back smaller', weights: {} },
      { label: "I don't take another trade that day", weights: { hesitator: 1 } },
    ],
  },
  {
    id: 'in_a_winner',
    prompt: "You're up on a trade and it's still moving your way.",
    options: [
      { label: 'I close it early. I always close it early', weights: { giver_backer: 4 } },
      { label: 'I move my stop to break even and then it stops me out', weights: { giver_backer: 2, rule_breaker: 2 } },
      { label: 'I hold to my target', weights: {} },
      { label: 'I add to it, past what I planned to risk', weights: { rule_breaker: 3 } },
    ],
  },
  {
    id: 'the_plan',
    prompt: 'Be honest — how often do you trade the plan you wrote down?',
    options: [
      { label: 'I write one and then do something else', weights: { rule_breaker: 4 } },
      { label: 'Most days, until something moves fast', weights: { rule_breaker: 2 } },
      { label: 'Nearly always', weights: {} },
      { label: "I don't really write one", weights: { rule_breaker: 2, overtrader: 2 } },
    ],
  },
  {
    id: 'no_setup',
    prompt: "Your setup hasn't shown up all session. It's quiet.",
    options: [
      { label: 'I take something anyway. Being flat feels worse', weights: { overtrader: 4 } },
      { label: 'I drop to a lower timeframe to find one', weights: { overtrader: 3 } },
      { label: 'I close the platform', weights: {} },
      { label: 'I watch and take nothing', weights: {} },
    ],
  },
  {
    id: 'missed_it',
    prompt: 'How often do you call a move correctly and then not take it?',
    options: [
      { label: 'Constantly. It is my most expensive habit', weights: { hesitator: 4 } },
      { label: 'Often enough that it annoys me', weights: { hesitator: 2 } },
      { label: 'Rarely', weights: {} },
      { label: 'I get in late instead, after it has already moved', weights: { hesitator: 2, revenge: 1 } },
    ],
  },
  {
    id: 'bad_week',
    prompt: 'Think about your last bad week. What actually caused it?',
    options: [
      { label: 'One loss I then tried to win back', weights: { revenge: 4 } },
      { label: 'Lots of small trades that added up', weights: { overtrader: 3 } },
      { label: 'I gave back everything I made earlier in the week', weights: { giver_backer: 4 } },
      { label: 'I broke my own rules and knew it at the time', weights: { rule_breaker: 3 } },
    ],
  },
];

export interface ArchetypeResult {
  /* Identity language. This is the line somebody screenshots. */
  name: string;
  /* One sentence that should make them feel caught, not judged. */
  headline: string;
  /* What it costs, concretely - the part that makes it worth fixing. */
  costsYou: string;
  /*
    The moment it happens. Naming the moment is what makes the verdict feel
    specific rather than horoscopic: anybody can be told they are impulsive,
    but "the twenty minutes after a red trade" is a thing they can picture.
  */
  moment: string;
  /* What TradeX does about this one, stated as a mechanism not a feature. */
  whatHelps: { title: string; detail: string }[];
  /* The CTA, calibrated to this result rather than generic. */
  cta: string;
}

export const ARCHETYPES: Record<Archetype, ArchetypeResult> = {
  revenge: {
    name: 'The Even-Getter',
    headline: 'You do not lose money on the losing trade. You lose it on the next one.',
    costsYou:
      'A single red trade turns into a red day, because the trade after it is bigger, faster and taken for the wrong reason. The first loss was the cost of doing business. The second one was a decision.',
    moment: 'The twenty minutes after a stop-out',
    whatHelps: [
      {
        title: 'It knows you just took a loss',
        detail: 'Before the next entry, TradeX says so — and asks for a reason in writing before you take it.',
      },
      {
        title: 'It shows you the pattern in money',
        detail: 'Your win rate on the trade immediately after a loss, against every other trade you take. Most people have never seen that number.',
      },
    ],
    cta: 'See what your post-loss trades actually cost',
  },

  hesitator: {
    name: 'The Watcher',
    headline: 'You are right more often than your account suggests.',
    costsYou:
      'Your analysis is not the problem — the gap between seeing it and taking it is. The trades you talk yourself out of would have worked, and the ones you eventually chase were the same idea twenty minutes too late.',
    moment: 'The seconds before the entry',
    whatHelps: [
      {
        title: 'It records the trade you did not take',
        detail: 'Call it out loud in ten seconds. TradeX logs it, then tells you later what it would have done.',
      },
      {
        title: 'It separates caution from correctness',
        detail: 'Once there are thirty of them, the pattern is arithmetic rather than a feeling: whether hesitating protects you, or costs you.',
      },
    ],
    cta: 'See what the trades you skipped would have done',
  },

  rule_breaker: {
    name: 'The Plan Abandoner',
    headline: 'You do not need a better strategy. You need to actually run the one you have.',
    costsYou:
      'You already know what works. The stop gets moved, the size gets doubled, the setup gets taken half-formed — and each one felt reasonable at the time. It is not the plan failing. It is the plan not being run.',
    moment: 'Mid-trade, when it starts moving',
    whatHelps: [
      {
        title: 'Your rules, checked against every trade',
        detail: 'Write them once. TradeX marks each trade against them, so "I followed my plan" becomes a number rather than an impression.',
      },
      {
        title: 'A checklist before you enter, not after',
        detail: 'The moment you break a rule is the moment it is hardest to notice. This is the thing that notices.',
      },
    ],
    cta: 'See which of your rules you actually break',
  },

  giver_backer: {
    name: 'The Handbacker',
    headline: 'Your problem is not finding winners. It is keeping them.',
    costsYou:
      'You cut the good ones early and let the bad ones run, so a week that was green on Wednesday is flat by Friday. Your average win is smaller than your average loss — and that single ratio is doing more damage than your win rate ever could.',
    moment: 'While a trade is green',
    whatHelps: [
      {
        title: 'It measures what you left on the table',
        detail: 'Every exit against where the trade actually went. The gap is usually the whole problem, and it is invisible without a record.',
      },
      {
        title: 'Your win and loss sizes, side by side',
        detail: 'Not win rate. The ratio underneath it, which is what decides whether a profitable strategy makes you money.',
      },
    ],
    cta: 'See how much your early exits gave back',
  },

  overtrader: {
    name: 'The Always-In',
    headline: 'Being flat feels worse to you than being wrong.',
    costsYou:
      'The good trades are in there. They are buried under the ones taken because nothing was happening and sitting still was unbearable — and commissions, spread and small losses do the rest.',
    moment: 'A quiet session with nothing to do',
    whatHelps: [
      {
        title: 'It counts today against your average',
        detail: 'TradeX says how many you have taken, and what your win rate does after trade four. For most people it falls off a cliff.',
      },
      {
        title: 'It tells the setups apart',
        detail: 'Your A-setups against everything else, by result. The case for sitting on your hands stops being advice and becomes your own data.',
      },
    ],
    cta: 'See what your extra trades are costing you',
  },
};

/*
  Which archetype won.

  Ties break toward the archetype with the single strongest answer rather
  than alphabetically, because a 4-weight answer is somebody describing
  their own problem in plain words and should outrank two 2s.

  Returns the runner-up too. Nobody is one thing, and naming the second
  makes the first more credible rather than less - a verdict that admits its
  own nuance reads as a diagnosis rather than a horoscope.
*/
export function scoreAudit(answers: Record<string, number>): {
  primary: Archetype;
  secondary: Archetype | null;
} {
  const totals: Record<Archetype, number> = {
    revenge: 0, hesitator: 0, rule_breaker: 0, giver_backer: 0, overtrader: 0,
  };
  const strongest: Record<Archetype, number> = { ...totals };

  for (const q of QUESTIONS) {
    const chosen = answers[q.id];
    if (chosen === undefined) continue;
    const option = q.options[chosen];
    if (!option) continue;
    for (const [key, weight] of Object.entries(option.weights)) {
      const a = key as Archetype;
      totals[a] += weight ?? 0;
      strongest[a] = Math.max(strongest[a], weight ?? 0);
    }
  }

  const ranked = (Object.keys(totals) as Archetype[]).sort((a, b) =>
    totals[b] - totals[a] || strongest[b] - strongest[a]);

  /*
    Everything at zero means every answer was a healthy one. That is a real
    outcome and it would be a lie to invent a failing for it - it maps to
    the Watcher, whose description is the only one that is not an accusation.
  */
  if (totals[ranked[0]] === 0) return { primary: 'hesitator', secondary: null };

  /* A runner-up is only worth naming if it is genuinely close behind. */
  const second = totals[ranked[1]] >= totals[ranked[0]] * 0.5 && totals[ranked[1]] > 0
    ? ranked[1]
    : null;

  return { primary: ranked[0], secondary: second };
}
