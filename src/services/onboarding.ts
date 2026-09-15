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

/*
  The third answer also stamps the completion time, so a profile carrying
  answers but no timestamp is somebody who dropped out part-way - which is
  the number that says whether three questions is one too many.
*/
export const saveStruggle = (value: Struggle) =>
  save({
    onboarding_struggle: value,
    onboarding_completed_at: new Date().toISOString(),
  });
