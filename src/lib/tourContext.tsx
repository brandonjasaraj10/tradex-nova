import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { seedTourDemoData, cleanupTourDemoData, type TourDemoDataIds } from './tourDemoData';

export type TourStep = {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  route?: string;
  maxHeight?: number;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-tour="dashboard-header"]',
    title: 'Welcome to TradeX!',
    content: "I'm Nova, your AI trading assistant. Let me show you around your new trading journal.",
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'account-selector',
    targetSelector: '[data-tour="account-selector"]',
    title: 'Add Your Trading Accounts',
    content: 'Add multiple trading accounts here - personal, funded, or prop firm - and switch between them any time to filter everything in TradeX to just that account.',
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'quick-access',
    targetSelector: '[data-tour="quick-access"]',
    title: 'Quick Navigation',
    content: 'Use these shortcuts to quickly access your Journal, Analytics, Nova AI, and Settings.',
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'metrics',
    targetSelector: '[data-tour="metrics"]',
    title: 'Your Performance Metrics',
    content: 'Track your trading performance at a glance - P&L, win rate, profit factor, and your Nova Score. This is what it looks like once you have some trades logged.',
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'calendar-page',
    targetSelector: '[data-tour="calendar-page"]',
    title: 'Trading Calendar',
    content: 'Visualize your trading activity day by day - P&L or psychology score. Click any day to jump straight to your journal entry for it.',
    position: 'top',
    route: '/calendar',
  },
  {
    id: 'calendar-weekly-review',
    targetSelector: '[data-tour="calendar-weekly-review"]',
    title: 'Weekly Review Cards',
    content: "Every week gets an auto-generated summary card - trades, win rate, and key takeaways - right alongside that week's days.",
    position: 'left',
    route: '/calendar',
  },
  {
    id: 'nova-chat',
    targetSelector: '[data-tour="nova-chat"]',
    title: 'Nova AI Assistant',
    content: "Ask me anything about your trades, get insights, or discuss strategies. I'm here to help you improve!",
    position: 'bottom',
    route: '/nova',
  },
  {
    id: 'checklists',
    targetSelector: '[data-tour="checklists-page"]',
    title: 'Trading Plan & Confluences',
    content: 'Define your trading rules and confluences here, then track how often you actually follow them. Consistency is key to profitable trading!',
    position: 'top',
    route: '/checklists',
  },
  {
    id: 'journal-intro',
    targetSelector: '[data-tour="journal-header"]',
    title: 'Your Trading Journal',
    content: 'Document every trade, capture your thoughts, and track your psychological state. This is where real improvement happens.',
    position: 'bottom',
    route: '/journal',
  },
  {
    id: 'journal-folders',
    targetSelector: '[data-tour="journal-folders"]',
    title: 'Organize with Folders',
    content: 'Use the Daily Journal folder for your trading reflections and the Notes folder for important observations and strategies.',
    position: 'right',
    route: '/journal',
  },
  {
    id: 'journal-editor',
    targetSelector: '[data-tour="journal-editor"]',
    title: 'Document Your Trading Journey',
    content: 'Write detailed entries with formatting, add screenshots, track your mood, and tag important concepts.',
    position: 'bottom',
    route: '/journal',
  },
  {
    id: 'journal-voice-input',
    targetSelector: '[data-tour="journal-voice-input"]',
    title: 'Voice Journaling',
    content: 'Click the button, speak your thoughts, and Nova will automatically organize and format your entry for you.',
    position: 'left',
    route: '/journal',
  },
  {
    id: 'journal-organize-nova',
    targetSelector: '[data-tour="journal-organize-nova"]',
    title: 'Or Just Type and Organize',
    content: "Prefer typing? Write your notes in plain, messy language and this button appears - click it and Nova reorganizes what you wrote and fills in the details for you, same as voice.",
    position: 'left',
    route: '/journal',
  },
  {
    id: 'journal-screenshots',
    targetSelector: '[data-tour="journal-screenshots"]',
    title: 'Attach Chart Screenshots',
    content: 'Upload before and after screenshots of your trades, or paste an image URL. They stay attached to the entry for whenever you want to look back.',
    position: 'top',
    route: '/journal',
  },
  {
    id: 'analytics-intro',
    targetSelector: '[data-tour="analytics-header"]',
    title: 'Deep Analytics',
    content: 'Analyze your trading performance with detailed charts and metrics. Understand what works and what needs improvement.',
    position: 'bottom',
    route: '/analytics',
  },
  {
    id: 'analytics-nova-score',
    targetSelector: '[data-tour="analytics-nova-score"]',
    title: 'Your Nova Score',
    content: 'A comprehensive score based on profitability, consistency, risk management, discipline, and execution.',
    position: 'right',
    route: '/analytics',
  },
  {
    id: 'analytics-charts',
    targetSelector: '[data-tour="analytics-charts"]',
    title: 'Performance Charts',
    content: 'Visualize P&L trends, win rates by symbol, time of day performance, and more to optimize your strategy.',
    position: 'top',
    route: '/analytics',
  },
  {
    id: 'analytics-insights',
    targetSelector: '[data-tour="analytics-insights"]',
    title: 'AI-Powered Insights',
    content: 'I analyze your trading patterns automatically and provide personalized recommendations to improve your results.',
    position: 'top',
    route: '/analytics',
  },
  {
    id: 'settings-intro',
    targetSelector: '[data-tour="settings-header"]',
    title: 'Account Settings',
    content: 'Manage your profile, security settings, subscription, and preferences all in one place.',
    position: 'bottom',
    route: '/settings',
  },
  {
    id: 'settings-accounts',
    targetSelector: '[data-tour="settings-brokers"]',
    title: 'Manage Your Trading Accounts',
    content: 'Add trading accounts and import your trade history from any broker via CSV or statement upload.',
    position: 'top',
    route: '/settings',
  },
  {
    id: 'tour-complete',
    targetSelector: '[data-tour="sidebar-logo"]',
    title: "You're All Set!",
    content: "You've completed the tour! Start by adding a trading account or manually logging your first trade. I'm always here if you need help.",
    position: 'right',
    route: '/dashboard',
  },
];

type TourContextType = {
  isActive: boolean;
  currentStep: number;
  currentStepData: TourStep | null;
  totalSteps: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  tourCompleted: boolean;
  restartTour: () => void;
  navigateToStep: (route: string) => void;
};

const TourContext = createContext<TourContextType | undefined>(undefined);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, setIsFirstTimeUser } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [hasCheckedTourStatus, setHasCheckedTourStatus] = useState(false);
  const hasEndedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const demoDataIdsRef = useRef<TourDemoDataIds | null>(null);
  const hasSeededDemoDataRef = useRef(false);

  useEffect(() => {
    if (user && !hasCheckedTourStatus) {
      checkTourStatus();
    }
  }, [user?.id]);

  useEffect(() => {
    // Seed once, the moment the tour actually becomes visible - not
    // earlier, so this never runs for an account that never ends up
    // seeing the tour at all.
    if (isActive && user && !hasSeededDemoDataRef.current) {
      hasSeededDemoDataRef.current = true;
      seedTourDemoData(user.id).then(ids => {
        demoDataIdsRef.current = ids;
      });
    }
  }, [isActive, user]);

  useEffect(() => {
    // Gate purely on tour_completed (durable, from the DB) rather than
    // isFirstTimeUser (an in-memory flag set only inside signUp() and
    // wiped by any reload or a later signIn()). A user blocked by the
    // subscription paywall right after signing up, or who just closes
    // the tab and logs back in later, would set isFirstTimeUser back to
    // false and never see the tour again even though tour_completed was
    // still false - this is what happened for real.
    if (
      !tourCompleted &&
      hasCheckedTourStatus &&
      !isActive &&
      !hasEndedRef.current &&
      !hasStartedRef.current
    ) {
      const timer = setTimeout(() => {
        if (!hasEndedRef.current && !hasStartedRef.current) {
          hasStartedRef.current = true;
          setCurrentStep(0);
          setIsActive(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted, hasCheckedTourStatus, isActive]);

  const checkTourStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('tour_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        const completed = data.tour_completed === true;
        setTourCompleted(completed);
        if (completed) {
          hasEndedRef.current = true;
        }
      }
    } catch (err) {
      console.error('Error checking tour status:', err);
    } finally {
      setHasCheckedTourStatus(true);
    }
  };

  const markTourCompleted = useCallback(async () => {
    if (!user) return;

    hasEndedRef.current = true;
    setTourCompleted(true);
    setIsFirstTimeUser(false);
    setIsActive(false);
    setCurrentStep(0);

    if (demoDataIdsRef.current) {
      cleanupTourDemoData(user.id, demoDataIdsRef.current);
      demoDataIdsRef.current = null;
    }

    try {
      await supabase
        .from('user_profiles')
        .update({ tour_completed: true })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error marking tour completed:', err);
    }
  }, [user, setIsFirstTimeUser]);

  const navigateToStep = useCallback(() => {}, []);

  const startTour = useCallback(() => {
    if (hasEndedRef.current) return;
    hasStartedRef.current = true;
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    markTourCompleted();
  }, [markTourCompleted]);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    endTour();
  }, [endTour]);

  const restartTour = useCallback(() => {
    hasEndedRef.current = false;
    hasStartedRef.current = true;
    setTourCompleted(false);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const currentStepData = isActive ? TOUR_STEPS[currentStep] : null;

  const contextValue = {
    isActive,
    currentStep,
    currentStepData,
    totalSteps: TOUR_STEPS.length,
    startTour,
    endTour,
    nextStep,
    previousStep,
    skipTour,
    tourCompleted,
    restartTour,
    navigateToStep,
  };

  return (
    <TourContext.Provider value={contextValue}>
      {children}
    </TourContext.Provider>
  );
}

export function TourNavigationSetter({ navigate }: { navigate: (route: string) => void }) {
  const { isActive, currentStepData } = useTour();
  const prevRouteRef = useRef<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (isActive && currentStepData?.route && currentStepData.route !== prevRouteRef.current) {
      prevRouteRef.current = currentStepData.route;
      setIsNavigating(true);

      // Navigate immediately
      navigate(currentStepData.route);

      // Give more time for the new page to render and mount
      setTimeout(() => {
        setIsNavigating(false);
      }, 1200);
    }
  }, [isActive, currentStepData, navigate]);

  return null;
}
