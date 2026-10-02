import type { Struggle } from '../services/onboarding';
import type { NamedItem } from '../services/voiceJournal';
import type { ProfileAnswers } from './onboardingPlan';

/*
  The starter checklist, built from what they just told us.

  WHY THIS EXISTS

  A brand new account has zero rules, zero confluences and zero psychology
  checks - checked against the database, not assumed. So the plan screen was
  promising "your rules come out of your head and onto a checklist you tick
  before entry" and then showing an entry with no checklist in it, and the
  app they land in afterwards opens on three empty panels.

  That is the blank-canvas problem the onboarding research is most consistent
  about: guided empty states beat blank ones, and the apps that populate the
  first session from the onboarding answers are the ones whose day-one
  retention holds up. So onboarding stops describing the checklist and starts
  writing it.

  WHY RULES AND PSYCHOLOGY BUT NOT CONFLUENCES

  Rules and pre-trade checks are close to universal - stop set before entry,
  not chasing a loss - and the answers we have point straight at which ones
  this person needs. Confluences are the trader's own setup: whether they
  want "4H trend aligned" or "sweep of liquidity then reclaim" is a question
  about their strategy, which nothing in these eight questions asks. Guessing
  it would put words in their mouth about the one thing that is actually
  theirs, so it is left empty for them to fill in.

  THE IDS ARE SLUGS, NOT UUIDS

  None of these are database rows yet - they cannot be, since inserting into
  trading_rules requires an active subscription. Nova only ever echoes the id
  back to say whether it was followed, so a slug does the job, and the real
  rows get their own ids when these are written after subscription.
*/

export interface StarterItem extends NamedItem {
  /* Why this one is on their list, shown nowhere - kept for the write-back. */
  reason: string;
}

/*
  Ordered by how strongly the answers point at them. Only the first four are
  used: a checklist somebody has to read before every entry stops being read
  somewhere around five, and the point is that it gets used.
*/
export function buildStarterRules(
  struggles: Struggle[],
  profile: ProfileAnswers,
): StarterItem[] {
  const candidates: StarterItem[] = [];

  if (profile.after_loss === 'bigger') {
    candidates.push({
      id: 'rule-same-size-after-loss',
      name: 'Same size after a loss',
      reason: 'You said the next position gets bigger.',
    });
  }

  if (struggles.includes('revenge_trading')) {
    candidates.push({
      id: 'rule-wait-after-loss',
      name: 'Wait 15 minutes before the next trade after a loss',
      reason: 'You picked revenge trading.',
    });
  }

  if (profile.green_day === 'keep_going' || profile.green_day === 'depends') {
    candidates.push({
      id: 'rule-stop-at-target',
      name: 'Stop when I hit my daily target',
      reason: 'You said you keep going when you are up.',
    });
  }

  if (struggles.includes('overtrading')) {
    candidates.push({
      id: 'rule-max-trades',
      name: 'No more than 3 trades a day',
      reason: 'You picked overtrading.',
    });
  }

  if (profile.what_ended_it === 'one_day') {
    candidates.push({
      id: 'rule-daily-loss-limit',
      name: 'Stop for the day at my loss limit',
      reason: 'You said one bad day ended the last account.',
    });
  }

  /*
    Always last in the list and almost always included, because it is the one
    rule whose absence shows up in every account that dies in a single
    session, and because a checklist of four that does not mention the stop
    would be a strange thing to hand a trader.
  */
  candidates.push({
    id: 'rule-stop-before-entry',
    name: 'Stop loss set before I enter',
    reason: 'The one that decides how bad a bad day gets.',
  });

  return candidates.slice(0, 4);
}

/*
  Ticked before the trade rather than judged after it, which is what makes
  these different from rules. Three, not more: this is read in the seconds
  before an entry.
*/
export function buildStarterPsychChecks(
  struggles: Struggle[],
  profile: ProfileAnswers,
): StarterItem[] {
  const candidates: StarterItem[] = [];

  if (profile.after_loss === 'bigger' || struggles.includes('revenge_trading')) {
    candidates.push({
      id: 'psych-not-winning-back',
      name: 'I am not trying to win back a loss',
      reason: 'You said size goes up after a red one.',
    });
  }

  if (struggles.includes('breaking_rules') || profile.rules_live !== 'written') {
    candidates.push({
      id: 'psych-know-my-exit',
      name: 'I know where I am wrong before I enter',
      reason: 'You said the rules live in your head.',
    });
  }

  if (struggles.includes('overtrading') || profile.green_day === 'keep_going') {
    candidates.push({
      id: 'psych-this-is-a-setup',
      name: 'This is a setup, not boredom',
      reason: 'You said you keep trading when the day is already won.',
    });
  }

  candidates.push({
    id: 'psych-would-take-again',
    name: 'I would take this again at half the size',
    reason: 'The quickest test of whether the size is the plan or the feeling.',
  });

  return candidates.slice(0, 3);
}
