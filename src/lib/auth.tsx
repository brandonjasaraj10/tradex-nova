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
        .select('status, current_period_end, grace_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return false;
      }

      const now = new Date();
      const currentPeriodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
      const gracePeriodEnd = data.grace_period_end ? new Date(data.grace_period_end) : null;

      if (data.status === 'active' || data.status === 'trialing') {
        return true;
      }

      if (data.status === 'canceled' && currentPeriodEnd && now < currentPeriodEnd) {
        return true;
      }

      if (data.status === 'past_due' && gracePeriodEnd && now < gracePeriodEnd) {
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

    // Refresh session every 30 minutes to prevent JWT expiration
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.refreshSession();
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
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
    <AuthContext.Provider value={{ user, profile, loading, showWelcome, needsProfile, needsSubscription, isFirstTimeUser, setShowWelcome, setNeedsProfile, setNeedsSubscription, setIsFirstTimeUser, refreshProfile, refreshSubscription, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}