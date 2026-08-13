import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

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
    content: 'Track your trading performance at a glance - P&L, win rate, profit factor, and your Nova Score.',
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'calendar',
    targetSelector: '[data-tour="calendar"]',
    title: 'Trading Calendar',
    content: 'Visualize your trading activity day by day. Click any day to view or add journal entries.',
    position: 'right',
    route: '/dashboard',
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
    id: 'trading-plan',
    targetSelector: '[data-tour="trading-plan"]',
    title: 'Trading Plan & Confluences',
    content: 'Define your trading rules and confluences here. Consistency is key to profitable trading!',
    position: 'top',
    route: '/dashboard',
    maxHeight: 500,
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
    maxHeight: 250,
  },
  {
    id: 'journal-editor',
    targetSelector: '[data-tour="journal-editor"]',
    title: 'Document Your Trading Journey',
    content: 'Write detailed entries with formatting, add screenshots, track your mood, and tag important concepts.',
    position: 'bottom',
    route: '/journal',
    maxHeight: 700,
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
    id: 'settings-brokers',
    targetSelector: '[data-tour="settings-brokers"]',
    title: 'Connect Your Broker',
    content: 'Link your trading accounts and add multiple accounts. We support MetaTrader 4/5 and manual CSV uploads from any broker.',
    position: 'top',
    route: '/settings',
  },
  {
    id: 'tour-complete',
    targetSelector: '[data-tour="sidebar-logo"]',
    title: "You're All Set!",
    content: "You've completed the tour! Start by connecting a broker or manually logging your first trade. I'm always here if you need help.",
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
  const { user, isFirstTimeUser, setIsFirstTimeUser } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [hasCheckedTourStatus, setHasCheckedTourStatus] = useState(false);
  const hasEndedRef = useRef(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (user && !hasCheckedTourStatus) {
      checkTourStatus();
    }
  }, [user?.id]);

  useEffect(() => {
    if (
      isFirstTimeUser &&
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
  }, [isFirstTimeUser, tourCompleted, hasCheckedTourStatus, isActive]);

  const checkTourStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('tour_completed')
        .eq('id', user.id)
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

    try {
      await supabase
        .from('user_profiles')
        .update({ tour_completed: true })
        .eq('id', user.id);
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
