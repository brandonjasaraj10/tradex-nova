import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface UserPreferences {
  timezone: string;
  currency: string;
  dateFormat: string;
}

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

/*
  Start from the browser's actual timezone rather than UTC.

  A new account had no saved preference, so Settings showed "UTC+0:00" to
  someone in Denver - a setting that looks deliberately chosen and is simply
  the fallback. The browser already knows the answer, and the app reads it
  this way elsewhere when telling Nova what "today" means.

  This is no longer display-only, which is why it now gets written back.
  ensure_journal_entry_for_trade files a synced trade on the day it closed
  IN THIS TIMEZONE, so a wrong value here puts a real trade on the wrong
  page - and 'UTC' is wrong for almost everybody holding it.
*/
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const defaultPreferences: UserPreferences = {
  timezone: detectTimezone(),
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY'
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  const loadPreferences = async () => {
    if (!user) {
      setPreferences(defaultPreferences);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('timezone, currency, date_format, timezone_is_explicit')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        /*
          Save the browser's timezone over a default nobody chose.

          The column defaults to 'UTC' and only changes if somebody opens
          Settings, so almost every account carries UTC without meaning it.
          That was cosmetic until trades began being filed by close date in
          this timezone: a trade closing 01:54 UTC is the previous evening
          in Denver, so it landed on tomorrow's journal page while the trade
          list, which reads the browser, showed it on today's.

          Guarded by timezone_is_explicit rather than by comparing against
          'UTC', because "UTC because nobody asked" and "UTC because I chose
          it" look identical in the column and must not be treated the same.
          Once somebody has chosen, this never touches it again.

          Failure here is deliberately silent: a preference that could not
          be saved is not worth interrupting anybody's session over, and it
          will simply be retried on the next load.
        */
        let timezone = data.timezone || defaultPreferences.timezone;
        const detected = detectTimezone();

        if (!data.timezone_is_explicit && detected !== timezone) {
          timezone = detected;
          supabase
            .from('user_profiles')
            .update({ timezone: detected })
            .eq('user_id', user.id)
            .then(({ error: saveError }) => {
              if (saveError) console.error('Could not save detected timezone:', saveError);
            });
        }

        setPreferences({
          timezone,
          currency: data.currency || defaultPreferences.currency,
          dateFormat: data.date_format || defaultPreferences.dateFormat
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const refreshPreferences = async () => {
    await loadPreferences();
  };

  return (
    <PreferencesContext.Provider value={{ preferences, loading, refreshPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
