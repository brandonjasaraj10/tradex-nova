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

  Note this preference is currently only displayed and saved; no date
  formatting reads it yet, so this makes the screen honest rather than
  changing behaviour.
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
        .select('timezone, currency, date_format')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          timezone: data.timezone || defaultPreferences.timezone,
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
