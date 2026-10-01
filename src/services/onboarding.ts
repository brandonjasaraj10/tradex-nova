import { supabase } from '../lib/supabase';

/*
  The three questions asked between signing up and seeing a price.

  Written to user_profiles, not user_trading_profiles. The trading profile is
  the obvious home and is the wrong one: every policy on it requires an
  active subscription, and nobody answering these has paid yet. The insert
  would be refused by RLS, the screen would advance anyway, and three
  questions would store nothing - a failure with no symptom.

  Each answer is saved the moment it is tapped rather than all three at the
  end. Somebody who closes the tab on question two has still told us what
  they trade, and that is worth keeping: a partial answer is data, and the
  drop-off itself is data.
*/

export type Instrument = 'futures' | 'forex' | 'stocks' | 'crypto';
export type Experience = 'just_started' | 'under_1_year' | '1_3_years' | '3_plus_years';
export type Struggle = 'revenge_trading' | 'overtrading' | 'breaking_rules' | 'not_sure';

export interface OnboardingAnswers {
  instrument?: Instrument;
  experience?: Experience;
  struggle?: Struggle;
}

/*
  Never throws, and never blocks the flow.

  These answers are worth having and are not worth standing between somebody
  and the product they just signed up for. If the write fails - offline, a
  policy we did not anticipate, a column not yet migrated - the question
  still advances and the answer is lost. That is the right trade at this
  point in the funnel; the alternative is an error message on question one
  of a signup.
*/
async function save(patch: Record<string, unknown>): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_profiles')
      .update(patch)
      .eq('user_id', user.id);

    if (error) console.error('Could not save onboarding answer:', error);
  } catch (err) {
    console.error('Could not save onboarding answer:', err);
  }
}

export const saveInstrument = (value: Instrument) =>
  save({ onboarding_instrument: value });

export const saveExperience = (value: Experience) =>
  save({ onboarding_experience: value });

export const saveStruggle = (value: Struggle) =>
  save({ onboarding_struggle: value });

/*
  The same question, asked as multi-select.

  Headspace found that letting people pick more than one goal lifted free
  trial conversion by 10%, and forcing one choice here was never honest
  anyway - somebody who revenge trades after a loss is usually also
  overtrading, and making them rank it teaches us nothing.

  Both columns are written. The singular one keeps the first pick because
  PAYOFF_HEADLINE, the paywall and 400 existing rows all read it, and there
  is no version of this worth breaking those for.
*/
export const saveStruggles = (values: Struggle[]) =>
  save({
    onboarding_struggles: values,
    ...(values[0] ? { onboarding_struggle: values[0] } : {}),
  });

/*
  The behavioural answers, written once at the end rather than per question.

  Five separate writes during a flow somebody is actively tapping through is
  five chances to be mid-request when they advance; one write of the whole
  object when the set is finished is simpler and loses nothing, because
  nothing reads these until the plan screen renders from them in memory.
*/
export const saveProfileAnswers = (answers: Record<string, string>) =>
  save({ onboarding_profile: answers });

/*
  Stamped when the flow actually ENDS, not when the last question is
  answered.

  It used to go in with the third answer, and that quietly deleted the best
  screen in the sequence. The gate in App.tsx renders onboarding only while
  onboarding_completed_at is null, so the moment the third tap wrote the
  timestamp the flow was, as far as the app was concerned, over - and the
  next profile refresh unmounted the component mid-flight, taking the
  tailored preview with it and dropping the user straight onto the paywall.

  A race, so it did not fail every time, which is the worst way for a funnel
  step to be broken: it looks fine when you check it.

  Moving the stamp here also makes it mean what its name says. "Completed"
  now means they reached the end and tapped through, rather than that they
  answered three questions and were then shown a price by accident. The
  drop-out measurement the old placement was for still works, and is
  sharper: answers with no timestamp is somebody who left part-way, and
  that now includes people who left on the preview.
*/
export const markOnboardingComplete = () =>
  save({ onboarding_completed_at: new Date().toISOString() });
