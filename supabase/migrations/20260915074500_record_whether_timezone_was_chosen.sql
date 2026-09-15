/*
  Whether the trader actually picked their timezone, or just has the default.

  user_profiles.timezone defaults to 'UTC' and is only ever written when
  somebody opens Settings and changes it - so 356 of 360 accounts say UTC,
  and almost none of them mean it. That was harmless while the column was
  only displayed. It stopped being harmless when trades started being filed
  to the journal by close date in the user's timezone: a trade closing at
  01:54 UTC is 19:54 the previous evening in Denver, so it lands on
  tomorrow's page while the rest of the app, which reads the browser, shows
  it on today's.

  The app can detect the real timezone from the browser, but it must not
  overwrite a deliberate choice to do it. Without this column the two cases
  are indistinguishable: 'UTC' because nobody asked, and 'UTC' because
  somebody chose it. This says which.

  Additive and defaulting to false, so every existing row correctly reads as
  "never chosen" - which for 356 of them is exactly true.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone_is_explicit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.timezone_is_explicit IS
  'True once the user has chosen a timezone in Settings. While false, the app may replace the stored timezone with the one the browser reports.';

/*
  The four accounts that already carry a non-UTC timezone can only have got
  it by changing it in Settings, so they are marked as chosen rather than
  being re-detected on next load.
*/
UPDATE public.user_profiles
SET timezone_is_explicit = true
WHERE timezone IS NOT NULL AND timezone <> 'UTC';
