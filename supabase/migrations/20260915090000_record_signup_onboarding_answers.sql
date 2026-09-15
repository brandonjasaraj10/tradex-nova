/*
  The three questions asked between signing up and seeing a price.

  On user_profiles rather than user_trading_profiles, which is where a
  trading profile would otherwise belong. That table requires an active
  subscription on select, insert AND update - correctly, it is paid-feature
  data - and onboarding happens before anybody has paid. Writing there would
  have been refused by RLS on every answer, silently: the insert fails, the
  screen advances, and three questions store nothing at all.

  user_profiles is deliberately ungated for exactly this reason (the same
  decision that keeps signup itself working), so the answers land here and
  can be copied into the trading profile later, once there is a subscription
  to permit it.

  Separate columns rather than one jsonb blob because these are meant to be
  counted: "how many of the people who signed up this month say revenge
  trading is costing them money" is the question this data exists to answer,
  and that is a group-by on a column rather than a scan through documents.

  All nullable. Every existing account predates the questions, and somebody
  who closes the tab on question two has answered one thing, not nothing -
  a partial answer is worth keeping and worth being able to see.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_instrument text,
  ADD COLUMN IF NOT EXISTS onboarding_experience text,
  ADD COLUMN IF NOT EXISTS onboarding_struggle text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.onboarding_instrument IS
  'Q1 - what they trade: futures, forex, stocks, crypto. NULL = never asked or skipped.';
COMMENT ON COLUMN public.user_profiles.onboarding_experience IS
  'Q2 - how long trading: just_started, under_1_year, 1_3_years, 3_plus_years.';
COMMENT ON COLUMN public.user_profiles.onboarding_struggle IS
  'Q3 - what is costing them money: revenge_trading, overtrading, breaking_rules, not_sure. The most commercially interesting of the three.';
COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS
  'Set when the third answer is given. NULL against a non-null answer means somebody dropped out mid-flow, which is worth being able to count.';
