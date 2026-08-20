import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState } from 'react';
import { checkSubscriptionAccess } from '../../services/subscriptionService';
import PageLoader from './PageLoader';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
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
    return <Navigate to="/payment" />;
  }

  return <>{children}</>;
}