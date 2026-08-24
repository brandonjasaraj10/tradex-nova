/*
  # Make user_trading_profiles match what the app actually writes

  "Personalize Nova" collects eight fields across a four-step wizard, and the
  table had homes for four of them. Completing the wizard returned

    PGRST204: Could not find the 'focus_areas' column of
    'user_trading_profiles' in the schema cache

  and the whole save was rejected. There are zero profile rows in this
  database - the feature has never once succeeded for anyone, which is also
  why nothing downstream ever noticed: Nova's system prompt has always
  formatted a profile that was never there.

  The rest of the stack already agrees on these names. PersonalizationModal
  writes them, userProfileService passes them through, and nova-chat's
  formatProfileForAI reads exactly these eight. Only the table disagreed, so
  the table is what changes here.

  The three legacy columns (trading_style, preferred_instruments,
  preferred_timeframes) are Bolt-era names for roughly these same ideas.
  They are left in place rather than renamed or dropped: nothing writes them,
  they are all null across zero rows, and removing columns is a separate and
  more deliberate decision than adding the ones the code needs today.
*/

ALTER TABLE user_trading_profiles
  ADD COLUMN IF NOT EXISTS trading_approach text,
  ADD COLUMN IF NOT EXISTS typical_trade_duration text,
  ADD COLUMN IF NOT EXISTS preferred_markets text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_sessions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS focus_areas text[] DEFAULT '{}';

COMMENT ON COLUMN user_trading_profiles.trading_approach IS
  'scalping | day_trading | swing_trading | position_trading - set by the Personalize Nova wizard. Supersedes the unused legacy trading_style column.';

COMMENT ON COLUMN user_trading_profiles.typical_trade_duration IS
  'minutes | hours | days | weeks_or_more - set by the Personalize Nova wizard.';
