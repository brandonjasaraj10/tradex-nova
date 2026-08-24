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
    /*
      Points at the editor, which always renders - not at the "Organize with
      Nova" button, which only appears once the editor has content.

      Targeting the button meant this step depended on demo data being
      written and displayed before the step ran, and that is a race: pages
      fetch on mount, the seed resolves later, and which wins varies. When
      it lost, the user's second step was a yellow "this element is not
      currently visible" warning. Seeding earlier narrowed the window but
      could not close it. A step in a five-step tour cannot be allowed to
      fail on timing, so it now describes the button rather than pointing at
      it - the editor beneath it is always there.
    */
    targetSelector: '[data-tour="journal-editor"]',
    title: 'Never format an entry again',
    content: "Type your notes however they come out - messy, half-finished, whatever. An Organize with Nova button appears above once you start writing: hit it and I'll pull out the symbol, direction, size and P&L, and write it up properly. Or talk it out with Voice Input.",
    position: 'bottom',
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

  /*
    Seed BEFORE the tour becomes visible, not after.

    Seeding while the tour was already running was a race nobody could win:
    pages fetch on mount, the insert resolves later, and whether the demo
    data appeared depended on which finished first. Nudging a refresh
    afterwards only narrowed the window - on the replay path the journal
    still mounted, loaded nothing, and left the "Organize with Nova" step
    pointing at a button that only exists when an entry is open.

    Awaiting the seed before activating removes the race entirely: by the
    time any page renders for the tour, the rows are already there.
  */
  const seedThenStart = useCallback(async () => {
    if (!user) return;
    if (!hasSeededDemoDataRef.current) {
      hasSeededDemoDataRef.current = true;
      try {
        // The seeded row ids used to be kept for cleanup; cleanup now finds
        // them by their is_tour_demo flag instead, so nothing needs holding
        // onto here. The ref this once assigned to no longer exists, and
        // referencing it threw a ReferenceError that this catch swallowed as
        // "seeding failed" on every single tour start - while the seeding
        // above had in fact already succeeded.
        await seedTourDemoData(user.id);
      } catch (err) {
        // A failed seed should not block the tour - it just means emptier
        // screens, which is better than no tour at all.
        console.error('Tour demo seeding failed:', err);
      }
      forceRefresh();
    }
    setCurrentStep(0);
    setIsActive(true);
  }, [user, forceRefresh]);

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
          void seedThenStart();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted, hasCheckedTourStatus, isActive, seedThenStart]);

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

    /*
      Unconditional: cleanup finds demo rows by their database flag, so it
      still works after a reload wiped whatever this session knew. The old
      `if (ref)` guard is exactly why interrupted tours stranded fake trades
      in real accounts.

      Awaited, and followed by a refresh. Fired and forgotten, the rows went
      but nothing told the screens to refetch - so the demo trades stayed
      visible until the user happened to navigate away and back, which reads
      as the tour data being real and sticking around.
    */
    await cleanupTourDemoData(user.id);
    forceRefresh();

    try {
      await supabase
        .from('user_profiles')
        .update({ tour_completed: true })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error marking tour completed:', err);
    }
  }, [user, setIsFirstTimeUser, forceRefresh]);

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
    /*
      Re-arm the seeding guard. It is a ref that only flips once per mount,
      so without clearing it a replay in the same session runs with no demo
      data - and the "Organize with Nova" step points at a button that only
      exists when the editor has content, so it would fail exactly the way
      it did before the refresh fix.
    */
    hasSeededDemoDataRef.current = false;
    setTourCompleted(false);
    void seedThenStart();
  }, [seedThenStart]);

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
