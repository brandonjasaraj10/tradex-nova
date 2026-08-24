import { Suspense, useState, useEffect } from 'react';
import { lazyWithReload } from './lib/lazyWithReload';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { AccountProvider } from './lib/accountContext';
import { DateRangeProvider } from './lib/dateRangeContext';
import { NovaProvider } from './lib/novaContext';
import { TourProvider, TourNavigationSetter } from './lib/tourContext';
import { DataSyncProvider } from './lib/dataSync';
import { PreferencesProvider } from './lib/preferencesContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import PrivateRoute from './components/shared/PrivateRoute';
import WelcomeAnimation from './components/shared/WelcomeAnimation';
import ProfileSetup from './components/auth/ProfileSetup';
import TourOverlay from './components/tour/TourOverlay';
import PageLoader from './components/shared/PageLoader';
import { trackPageView, setAuthState } from './lib/analytics';
import { captureAppPageView, identifyUser, resetUser } from './lib/productAnalytics';

// lazyWithReload, not React's bare lazy: a deploy renames every hashed chunk
// and deletes the old ones, so anyone with the page already open asks for a
// file that no longer exists and hits "Failed to fetch dynamically imported
// module". Seen for real in production from an Instagram in-app browser.
const Sales = lazyWithReload('Sales', () => import('./pages/Sales'));
const Auth = lazyWithReload('Auth', () => import('./pages/Auth'));
const Payment = lazyWithReload('Payment', () => import('./pages/Payment'));
const Dashboard = lazyWithReload('Dashboard', () => import('./pages/Dashboard'));
const Journal = lazyWithReload('Journal', () => import('./pages/Journal'));
const Analytics = lazyWithReload('Analytics', () => import('./pages/Analytics'));
const Calendar = lazyWithReload('Calendar', () => import('./pages/Calendar'));
const Settings = lazyWithReload('Settings', () => import('./pages/Settings'));
const Profile = lazyWithReload('Profile', () => import('./pages/Profile'));
const NovaAssistant = lazyWithReload('NovaAssistant', () => import('./pages/NovaAssistant'));
const Checklists = lazyWithReload('Checklists', () => import('./pages/Checklists'));
const TermsOfService = lazyWithReload('TermsOfService', () => import('./pages/TermsOfService'));
const PrivacyPolicy = lazyWithReload('PrivacyPolicy', () => import('./pages/PrivacyPolicy'));
const RiskDisclaimer = lazyWithReload('RiskDisclaimer', () => import('./pages/RiskDisclaimer'));
const NotFound = lazyWithReload('NotFound', () => import('./pages/NotFound'));

const PUBLIC_PATHS = ['/', '/auth', '/sales', '/terms', '/privacy', '/risk-disclaimer', '/payment'];

function PublicLayout() {
  return (
    <div className="min-h-screen bg-black">
      <main>
        <Suspense fallback={<PageLoader fullScreen />}>
          <Routes>
            <Route path="/" element={<Sales />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/risk-disclaimer" element={<RiskDisclaimer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function PrivateLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, showWelcome, needsProfile, needsSubscription, isFirstTimeUser, setShowWelcome, setNeedsProfile, setNeedsSubscription, refreshProfile, refreshSubscription } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getFirstName = () => {
    if (profile?.first_name) return profile.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  if (loading) {
    return <PageLoader fullScreen />;
  }

  if (needsProfile && user) {
    return (
      <ProfileSetup
        user={user}
        onComplete={async () => {
          await refreshProfile();
          setNeedsProfile(false);
        }}
      />
    );
  }

  if (needsSubscription && user && profile) {
    return (
      <Suspense fallback={<PageLoader fullScreen />}>
        <Payment
          onSubscriptionComplete={async () => {
            await refreshSubscription();
            setNeedsSubscription(false);
            setShowWelcome(true);
          }}
          isFirstTime={isFirstTimeUser}
        />
      </Suspense>
    );
  }

  /*
    Once a welcome is pending, the app must never render underneath it.

    This gate used to also require `profile`, but the dashboard below did
    not - so in the window where the user was set and the profile was still
    being fetched, this check failed, the app rendered, and the animation
    only appeared once the profile landed. That's the flash of dashboard
    before the welcome. Holding on the loader instead keeps the animation
    strictly first, and it still waits for the profile so the greeting uses
    the real first name rather than an email prefix.
  */
  /*
    Stripe sends people back to /dashboard?success=true, and nothing read it.

    setShowWelcome is only ever called from signIn, so the animation played
    for returning users signing in and never for the one person it was
    written for - the new user arriving for the first time, which is what its
    isFirstTime prop is about. Signing up does not call signIn, and neither
    does coming back from checkout, since that session is already
    authenticated. So paying dropped you straight onto the dashboard and into
    the tour with no welcome at all.

    Read during render rather than set from an effect: an effect runs after
    the first paint, so the dashboard would flash before the animation
    covered it - the exact problem the profile gate below was added to fix.
  */
  const justCompletedCheckout = new URLSearchParams(location.search).get('success') === 'true';

  if ((showWelcome || justCompletedCheckout) && user) {
    if (!profile) {
      return <PageLoader fullScreen />;
    }
    return (
      <WelcomeAnimation
        firstName={getFirstName()}
        /*
          isFirstTimeUser is React state set only inside signUp, and Stripe
          checkout is a full navigation away and back - so it is gone by the
          time someone returns from paying, and a brand new account was
          greeted with "Welcome Back" on its very first entry.

          tour_completed is the durable version of the same fact, already on
          the profile and already fetched. tourContext gates on it for exactly
          this reason, having been caught by transient state once before;
          replaying the tour only changes local state, never this column, so
          it stays a reliable "has never been onboarded" signal.
        */
        isFirstTime={isFirstTimeUser || !profile.tour_completed}
        onComplete={() => {
          setShowWelcome(false);
          // Drop ?success=true, or refreshing the dashboard would replay the
          // welcome every time.
          if (justCompletedCheckout) {
            navigate(location.pathname, { replace: true });
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="flex">
        <Sidebar
          onCollapseChange={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 w-full">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            sidebarOpen={mobileMenuOpen}
            onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
          <main className="pt-16">
            <Suspense fallback={<PageLoader className="min-h-[calc(100vh-4rem)]" />}>
              <Routes>
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/journal" element={<PrivateRoute><Journal /></PrivateRoute>} />
                <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/nova" element={<PrivateRoute><NovaAssistant /></PrivateRoute>} />
                <Route path="/checklists" element={<PrivateRoute><Checklists /></PrivateRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <TourOverlay />
        </div>
      </div>
      <TourNavigationSetter navigate={navigate} />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  // Wait for the auth check to settle, otherwise every returning user is
  // briefly reported as logged out on load and the segment is wrong.
  useEffect(() => {
    if (authLoading) return;
    setAuthState(!!user);
    // Tie activity to an account so retention/churn is readable per user;
    // reset on sign-out so the next person on a shared device isn't merged
    // into the previous one's history.
    if (user) identifyUser(user.id); else resetUser();
  }, [user, authLoading]);

  /*
    Report each route change to GA4. In a single-page app the browser
    performs exactly one document load, so GA's built-in pageview would
    record the landing page and nothing after it - every navigation from
    the landing page into signup, payment or the dashboard would be
    invisible, which is precisely the funnel worth measuring.
  */
  useEffect(() => {
    // The public/private split already computed above is exactly the
    // marketing-vs-app boundary, so reuse it rather than maintaining a
    // second list that could drift out of step with routing.
    const pageType = isPublicPage ? 'marketing' : 'app';
    trackPageView(location.pathname + location.search, pageType);
    captureAppPageView(location.pathname + location.search, pageType);
  }, [location.pathname, location.search, isPublicPage]);

  if (isPublicPage) {
    return <PublicLayout />;
  }

  return <PrivateLayout />;
}

function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <DataSyncProvider>
          <AccountProvider>
            <DateRangeProvider>
            <NovaProvider>
              <TourProvider>
                <AppContent />
              </TourProvider>
            </NovaProvider>
            </DateRangeProvider>
          </AccountProvider>
        </DataSyncProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;