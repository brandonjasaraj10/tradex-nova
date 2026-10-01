/*
  Room for the longer onboarding.

  Two additions, both nullable, both ignored by every existing read - this
  applies to production the moment it runs, while the code that writes it is
  still on a branch, so it has to be invisible until that code ships.

  onboarding_struggles: the same question as onboarding_struggle, asked as
  multi-select. Headspace found letting people pick more than one goal lifted
  trial conversion 10%, and the single-select version has been quietly
  forcing a choice on people whose honest answer is "all of them". The old
  singular column stays and keeps being written with the first pick, because
  PAYOFF_HEADLINE, the paywall and 400 existing rows all read it.

  onboarding_profile: the behavioural answers - the questions that make
  somebody describe the gap between what they know and what they do. JSON
  rather than a column each, because these questions will be rewritten and
  reordered repeatedly and a migration per edit is not a good trade for
  answers nothing joins on.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_struggles text[],
  ADD COLUMN IF NOT EXISTS onboarding_profile jsonb;

COMMENT ON COLUMN public.user_profiles.onboarding_struggles IS
  'Multi-select version of onboarding_struggle. The singular column is still written with the first pick for backwards compatibility.';

COMMENT ON COLUMN public.user_profiles.onboarding_profile IS
  'Free-form answers from the onboarding behavioural questions, keyed by question id.';
