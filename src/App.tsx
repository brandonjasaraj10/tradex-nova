import { Suspense, useState } from 'react';
import { lazyWithReload } from './lib/lazyWithReload';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { AccountProvider } from './lib/accountContext';
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

  if (showWelcome && user && profile) {
    return (
      <WelcomeAnimation
        firstName={getFirstName()}
        isFirstTime={isFirstTimeUser}
        onComplete={() => {
          setShowWelcome(false);
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
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

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
            <NovaProvider>
              <TourProvider>
                <AppContent />
              </TourProvider>
            </NovaProvider>
          </AccountProvider>
        </DataSyncProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;