import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ADMIN_EMAILS = [
  'brandon.jasaraj10@gmail.com',
  'imbrandonski@gmail.com',
];

const ADMIN_USER_IDS = [
  '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63',
];

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  // Selected by the profile query and used to tell a genuinely new user
  // from a returning one; declaring it keeps the type honest about the row.
  tour_completed?: boolean | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  showWelcome: boolean;
  needsProfile: boolean;
  needsSubscription: boolean;
  /*
    When a failed payment's grace period runs out, or null when there isn't
    one. checkSubscription already reads this column to decide access; it was
    collapsing it to a yes/no and throwing the date away, so nothing could
    tell the user their access is running out.
  */
  /*
    True when the subscription exists but its last payment failed. Distinct
    from "never subscribed": without a grace period a failed card now blocks
    access immediately, and these people must be offered a card update rather
    than a fresh plan - buying again would leave two subscriptions in Stripe
    and charge them twice.
  */
  pastDue: boolean;
  isFirstTimeUser: boolean;
  setShowWelcome: (show: boolean) => void;
  setNeedsProfile: (needs: boolean) => void;
  setNeedsSubscription: (needs: boolean) => void;
  setIsFirstTimeUser: (isFirst: boolean) => void;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [pastDue, setPastDue] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setNeedsProfile(false);
      setNeedsSubscription(false);
      setIsFirstTimeUser(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, tour_completed')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.first_name) {
        setProfile(data);
        setNeedsProfile(false);
      } else {
        setProfile(null);
        setNeedsProfile(true);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setNeedsProfile(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const checkSubscription = async (userId: string, userEmail?: string): Promise<boolean> => {
    try {
      if (
        (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) ||
        ADMIN_USER_IDS.includes(userId)
      ) {
        return true;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPastDue(false);
        return false;
      }

      const now = new Date();
      const currentPeriodEnd = data.current_period_end ? new Date(data.current_period_end) : null;

      setPastDue(data.status === 'past_due');

      if (data.status === 'active' || data.status === 'trialing') {
        return true;
      }

      if (data.status === 'canceled' && currentPeriodEnd && now < currentPeriodEnd) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      const hasAccess = await checkSubscription(user.id, user.email);
      setNeedsSubscription(!hasAccess);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to refresh the session first to ensure it's valid
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

        let currentSession = refreshedSession;

        // If refresh fails, try to get the current session
        if (refreshError || !currentSession) {
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Session retrieval error:', error);
            await handleSignOut();
            setLoading(false);
            return;
          }

          currentSession = session;
        }

        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
          const hasAccess = await checkSubscription(currentUser.id, currentUser.email);
          setNeedsSubscription(!hasAccess);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await handleSignOut();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
          const hasAccess = await checkSubscription(currentUser.id, currentUser.email);
          setNeedsSubscription(!hasAccess);
        } else {
          setProfile(null);
          setNeedsProfile(false);
          setNeedsSubscription(false);
        }
      })();
    });

    /*
      Refresh every 30 minutes so the access token never expires mid-session.

      The important part is what happens when the refresh FAILS. This used to
      catch the error, log it, and carry on - which left a session in
      localStorage that the server had already forgotten. getSession() reads
      that store without asking anybody, so the app went on believing it was
      signed in and handing a dead token to edge functions, which rejected it.

      Seen in production on 2026-09-13: signing in as a second account in the
      same browser retired the first session, and "Organize with Nova"
      answered "Nova could not organize that note" for half an hour. The auth
      log told the real story - /token returning refresh_token_not_found, then
      /user returning session_not_found - while the app showed no sign of
      being logged out at all.

      A refresh token the server does not recognise means the session is over.
      The only honest response is to end it here too, which puts the user on
      the sign-in screen instead of leaving them in a broken one.
    */
    const SESSION_IS_GONE = ['refresh_token_not_found', 'session_not_found', 'refresh_token_already_used'];

    const refreshNow = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error } = await supabase.auth.refreshSession();
        if (!error) return;

        const code = (error as { code?: string }).code ?? '';
        if (SESSION_IS_GONE.includes(code) || error.status === 400 || error.status === 403) {
          console.warn('Session is no longer valid on the server; signing out.', code || error.message);
          await supabase.auth.signOut();
          return;
        }
        // Anything else - a network blip, the auth service having a moment -
        // is not evidence the session is dead, so leave it alone and try
        // again on the next tick.
        console.error('Could not refresh the session:', error.message);
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    };

    const refreshInterval = setInterval(refreshNow, 30 * 60 * 1000); // 30 minutes

    /*
      And again whenever the tab comes back, which the interval alone cannot
      cover.

      Browsers throttle timers in background tabs and stop them entirely while
      the machine sleeps, so a 30-minute interval does not run on a laptop
      that was shut overnight. What happens next is that the first thing the
      user does on returning goes out carrying a token that expired hours ago,
      fails, and then works a few minutes later once the interval finally
      catches up.

      Reported exactly that way: Nova refusing to organise a voice note first
      thing in the morning, then behaving normally a couple of minutes later,
      on a tab that had been open since the night before.

      visibilitychange covers switching back to the tab; focus covers
      returning to the window with the tab already frontmost. Both are cheap -
      refreshSession is a no-op when the token is still fresh.
    */
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refreshNow();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setUser(data.user);
        setShowWelcome(true);
        return;
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error?.message === 'Failed to fetch' ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('network') ||
          error?.name === 'TypeError';

        if (isNetworkError && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (isNetworkError) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }

        console.error('Sign in error:', error);
        throw error;
      }
    }

    throw lastError;
  };

  const signUp = async (email: string, password: string) => {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setUser(data.user);
        setIsFirstTimeUser(true);
        setNeedsSubscription(true);
        return;
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error?.message === 'Failed to fetch' ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('network') ||
          error?.name === 'TypeError';

        if (isNetworkError && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (isNetworkError) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }

        console.error('Sign up error:', error);
        throw error;
      }
    }

    throw lastError;
  };

  const signOut = async () => {
    await handleSignOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, showWelcome, needsProfile, needsSubscription, pastDue, isFirstTimeUser, setShowWelcome, setNeedsProfile, setNeedsSubscription, setIsFirstTimeUser, refreshProfile, refreshSubscription, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}