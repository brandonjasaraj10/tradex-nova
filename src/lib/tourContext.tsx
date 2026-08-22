import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useDataSync } from './dataSync';
import { seedTourDemoData, cleanupTourDemoData } from './tourDemoData';

export type TourStep = {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  route?: string;
  maxHeight?: number;
};

/*
  Five steps, down from twenty-three.

  The benchmarks on product tours are unambiguous: median completion is
  about 15%, every step past three or four measurably reduces it, and tours
  over twenty steps lose a further 30-50%. The old tour ran twenty-three
  steps across seven pages, which put the two things nothing else on the
  market does - Organize with Nova, and Nova chat - at steps 8 and 14, well
  past the point most people had already closed it. The best material was
  the least likely to be seen.

  What survives is the core loop plus the differentiators, in the order
  someone actually needs them: the journal, the thing that makes journalling
  effortless, the AI that reads it back, the payoff view, and a clear first
  action. Calendar and Analytics keep one step between them because both are
  self-evident from the sidebar; folders, screenshots, settings and the
  metric-by-metric walkthrough are discoverable and were costing more
  completions than they earned.

  The greeting step went too. It cost a step to say hello and showed no
  capability, so its warmth moved into the first real step instead.
*/
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'journal-intro',
    targetSelector: '[data-tour="journal-header"]',
    title: 'This is where it all happens',
    content: "I'm Nova. Your journal is the heart of TradeX - log a trade, capture what you were thinking, and track how you felt. Let me show you the fastest way to use it.",
    position: 'bottom',
    route: '/journal',
  },
  {
    id: 'journal-organize-nova',
    targetSelector: '[data-tour="journal-organize-nova"]',
    title: 'Never format an entry again',
    content: "Type your notes however they come out - messy, half-finished, whatever. Hit this and I'll pull out the symbol, direction, size and P&L, and write it up properly. You can talk it out instead with Voice Input.",
    position: 'left',
    route: '/journal',
  },
  {
    id: 'nova-chat',
    targetSelector: '[data-tour="nova-chat"]',
    title: 'Ask me what you keep getting wrong',
    content: "I read your entries and your trades, so I can tell you what's actually costing you money - the setups you force, the days you overtrade, the patterns you can't see from the inside.",
    position: 'bottom',
    route: '/nova',
  },
  {
    id: 'calendar-page',
    targetSelector: '[data-tour="calendar-page"]',
    title: 'Your month at a glance',
    content: 'Every day coloured by P&L, or switch it to psychology score to see how your state of mind tracked your results. Click any day to open that entry.',
    position: 'top',
    route: '/calendar',
  },
  {
    id: 'tour-complete',
    targetSelector: '[data-tour="sidebar-logo"]',
    title: "That's the whole tour",
    content: "Best first move: add your trading account in Settings, then import your history from a CSV or log one trade by hand. Everything else fills in from there - and I'm in the sidebar whenever you need me.",
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
  const { forceRefresh } = useDataSync();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [hasCheckedTourStatus, setHasCheckedTourStatus] = useState(false);
  const hasEndedRef = useRef(false);
  const hasStartedRef = useRef(false);
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
      /*
        Refresh once the seed lands. Every page has already fetched its data
        by the time this resolves, so without a nudge the demo rows sit in
        the database unseen. That broke the "Organize with Nova" step
        outright - the button it points at only renders when the editor has
        content, so the step showed "element is not currently visible" while
        the entry existed in the database the whole time.
      */
      seedTourDemoData(user.id).then((ids) => {
        demoDataIdsRef.current = ids;
        forceRefresh();
      });
    }
  }, [isActive, user, forceRefresh]);

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

    // Unconditional: cleanup finds demo rows by their database flag, so
    // it still works after a reload wiped whatever this session knew.
    // The old `if (ref)` guard is exactly why interrupted tours stranded
    // fake trades in real accounts.
    cleanupTourDemoData(user.id);

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
