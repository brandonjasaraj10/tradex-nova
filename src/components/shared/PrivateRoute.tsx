import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState } from 'react';
import { checkSubscriptionAccess } from '../../services/subscriptionService';
import PageLoader from './PageLoader';
import { writeHeldFirstEntry } from '../../services/onboardingWriteBack';
import { FREE_PLAN_ENABLED } from '../../lib/featureFlags';
import ProLocked, { type ProFeature } from './ProLocked';

/*
  requirePaid names the Pro screen this route is. With the free plan on, a
  free user gets that screen's upgrade card instead of the paywall; every other
  route lets them in. With it off, nothing changes: no access means the paywall.
*/
export default function PrivateRoute({ children, requirePaid }: { children: React.ReactNode; requirePaid?: ProFeature }) {
  const { user, loading: authLoading } = useAuth();
  const [subscriptionChecking, setSubscriptionChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function checkAccess() {
      if (user && !authLoading) {
        if (location.pathname === '/payment') {
          setHasAccess(true);
          setSubscriptionChecking(false);
          return;
        }

        const access = await checkSubscriptionAccess();
        setHasAccess(access.hasAccess);
        /*
          The first point at which the entry from onboarding can be saved -
          see onboardingWriteBack. Not awaited: the page should not wait on it,
          and the journal picks the row up through realtime when it lands.
          On the free plan anyone signed in can save it.
        */
        if (access.hasAccess || FREE_PLAN_ENABLED) void writeHeldFirstEntry();
        setSubscriptionChecking(false);
      } else if (!authLoading) {
        setSubscriptionChecking(false);
      }
    }

    checkAccess();
  }, [user, authLoading, location.pathname]);

  if (authLoading || subscriptionChecking) {
    return <PageLoader className="min-h-[calc(100vh-4rem)]" />;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (!hasAccess && location.pathname !== '/payment') {
    if (!FREE_PLAN_ENABLED) return <Navigate to="/payment" />;
    if (requirePaid) return <ProLocked feature={requirePaid} />;
  }

  return <>{children}</>;
}
