import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ConfirmModal from '../components/shared/ConfirmModal';
import SupportReportForm from '../components/settings/SupportReportForm';
import {
  LogOut,
  User,
  Shield,
  CreditCard,
  Palette,
  Save,
  Key,
  Mail,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Play
} from 'lucide-react';
import Button from '../components/shared/Button';
import BrokerConnectionsList from '../components/broker/BrokerConnectionsList';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import PasswordStrengthIndicator, { isPasswordValid } from '../components/auth/PasswordStrengthIndicator';
import { usePreferences } from '../lib/preferencesContext';
import { useTour } from '../lib/tourContext';
/*
  Settings used to declare its own three-field Subscription type and query the
  table by hand. That is how it drifted: the local copy had no
  grace_period_end, so it could not have applied the real access rule even if
  it wanted to. Using the service means this screen and the paywall read the
  same row through the same code.
*/
import {
  getSubscription,
  evaluateSubscriptionAccess,
  type Subscription,
} from '../services/subscriptionService';

interface UserProfile {
  first_name: string;
  last_name: string;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { refreshPreferences } = usePreferences();
  const { restartTour } = useTour();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const subscriptionAccess = subscription
    ? evaluateSubscriptionAccess(subscription, new Date())
    : null;
  const [subLoading, setSubLoading] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    first_name: '',
    last_name: ''
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  // Inline error instead of alert(): the old handler used browser alerts,
  // which on the "current password is wrong" path is both jarring and
  // easy to dismiss without reading.
  const [passwordError, setPasswordError] = useState('');

  const [preferences, setPreferences] = useState({
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY'
  });

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  useEffect(() => {
    loadProfile();
    loadSubscription();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, timezone, currency, date_format')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || ''
        });
        setPreferences({
          timezone: data.timezone || 'UTC',
          currency: data.currency || 'USD',
          dateFormat: data.date_format || 'MM/DD/YYYY'
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadSubscription = async () => {
    if (!user) return;

    try {
      setSubscription(await getSubscription());
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };


  const handleManageBilling = async () => {
    setSubLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to manage billing');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create_portal_session',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error('Billing portal error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelConfirm(true);
  };

  const executeCancelSubscription = async () => {
    setShowCancelConfirm(false);
    setSubLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to cancel subscription');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'cancel_subscription',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const result = await response.json();
      await loadSubscription();
      alert(`Subscription cancelled successfully. Your access will continue until ${result.cancel_at}. A confirmation email has been sent to you.`);
    } catch (err) {
      console.error('Cancellation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubLoading(false);
    }
  };

  /*
    Clears tour_completed as well as starting the tour. Without that, the
    flag stays true and the tour would not re-arm on a later sign-in - and
    the seeding step keys off the same run, so demo data would not appear.
  */
  const handleReplayTour = async () => {
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ tour_completed: false })
        .eq('user_id', user.id);
    }
    restartTour();
    navigate('/dashboard');
  };

  const handleDeleteAccount = async () => {
    // Belt and braces - the button is already disabled unless both are set,
    // but this is the one action in the app that cannot be undone.
    if (deleteConfirmText !== 'DELETE' || !deletePassword) return;

    setDeleteError('');
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDeleteError('Your session expired. Please sign in again.');
        setDeleting(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDeleteError(result.error || 'Could not delete your account.');
        setDeleting(false);
        return;
      }

      // The account no longer exists, so clear the local session rather than
      // leaving a token for a deleted user sitting in the browser.
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Account deletion error:', err);
      setDeleteError('Something went wrong. Please try again or contact support.');
      setDeleting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    if (passwords.new !== passwords.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    /*
      Same strength rule as signup (8+ chars, upper, lower, number) rather
      than the 6-character minimum this used to apply on its own. Otherwise
      someone signs up under the strict rule and immediately weakens their
      password to "abc123" from this screen, and the strength meter they saw
      at signup never reappears to tell them.
    */
    if (!isPasswordValid(passwords.new)) {
      setPasswordError('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number');
      return;
    }

    if (passwords.new === passwords.current) {
      setPasswordError('New password must be different from your current one');
      return;
    }

    setPasswordError('');
    setLoading(true);
    try {
      /*
        Prove the current password before changing it.

        This screen collected "Current Password" and required it to be
        non-empty, but never actually checked it - the update went straight
        through. Verified against a real account: the password could be
        changed, and then used to sign in, without the old one ever being
        supplied. That means anyone reaching an already-signed-in session -
        an unattended laptop, a shared computer - could take the account
        over and lock the real owner out.

        Re-signing in with the supplied current password is the check.
        Supabase has no "verify password" call, and a failed sign-in does
        not disturb the existing session, so this is the standard approach.
      */
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwords.current,
      });

      if (reauthError) {
        setPasswordError('Current password is incorrect');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      setPasswords({ current: '', new: '', confirm: '' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          timezone: preferences.timezone,
          currency: preferences.currency,
          date_format: preferences.dateFormat,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      await refreshPreferences();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'contact', label: 'Contact Us', icon: Mail }
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row md:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 pt-6" data-tour="settings-header">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            <p className="text-sm sm:text-base text-gray-400 mt-1">Manage your account and preferences</p>
          </div>

          <Button
            className="mt-3 sm:mt-0"
            variant="secondary"
            size="sm"
            icon={<LogOut size={16} />}
            onClick={() => signOut()}
          >
            Log Out
          </Button>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="lg:w-64 flex-shrink-0">
            <nav className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1">
            <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-6 md:p-8">
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Personal Information</h2>
                    <p className="text-sm text-gray-400">Update your personal details</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          value={profile.first_name}
                          onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          value={profile.last_name}
                          onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                          type="email"
                          id="email"
                          value={user?.email || ''}
                          disabled
                          className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-black/20 border border-white/5 text-gray-400 cursor-not-allowed"
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">Email cannot be changed</p>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      icon={saveSuccess ? <Check size={16} /> : <Save size={16} />}
                      className={saveSuccess ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      {saveSuccess ? 'Saved!' : loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Account Security</h2>
                    <p className="text-sm text-gray-400">Manage your password and security settings</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          id="currentPassword"
                          value={passwords.current}
                          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                          className="w-full pl-11 pr-12 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          id="newPassword"
                          value={passwords.new}
                          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                          className="w-full pl-11 pr-12 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          id="confirmPassword"
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                  </div>

                  {/*
                    Same strength meter as signup. Without it this screen held
                    a weaker rule than the one the user was held to when they
                    registered, and gave no indication of what counted as
                    strong enough until the submit failed.
                  */}
                  {passwords.new && (
                    <PasswordStrengthIndicator password={passwords.new} />
                  )}

                  {passwordError && (
                    <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                      {passwordError}
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      onClick={handleChangePassword}
                      disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                      icon={<Shield size={16} />}
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>

                  {/*
                    Account deletion. The Privacy Policy promises "Delete your
                    account and data" and claims the GDPR right to erasure, but
                    nothing in the product could do it - a request meant editing
                    the database by hand.

                    Deliberately heavy to trigger: it is irreversible, so it
                    takes an explicit reveal, the exact word DELETE typed out,
                    and the account password. A single misclick should never be
                    able to destroy someone's trading history.
                  */}
                  <div className="mt-10 pt-8 border-t border-white/10">
                    <h3 className="text-base font-semibold text-white mb-1">Delete account</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Permanently deletes your account, journal entries, trades and screenshots.
                      Any active subscription is cancelled. This cannot be undone.
                    </p>

                    {!showDeleteAccount ? (
                      <button
                        onClick={() => setShowDeleteAccount(true)}
                        className="text-sm text-red-400 hover:text-red-300 underline underline-offset-4 transition-colors"
                      >
                        I want to delete my account
                      </button>
                    ) : (
                      <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Type <span className="font-mono text-white">DELETE</span> to confirm
                          </label>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-red-400/50 outline-none transition-all"
                            placeholder="DELETE"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Confirm your password
                          </label>
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-red-400/50 outline-none transition-all"
                            placeholder="Your password"
                          />
                        </div>

                        {deleteError && (
                          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                            {deleteError}
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deleting || deleteConfirmText !== 'DELETE' || !deletePassword}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/90 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {deleting ? 'Deleting...' : 'Permanently delete my account'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteAccount(false);
                              setDeleteConfirmText('');
                              setDeletePassword('');
                              setDeleteError('');
                            }}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Subscription</h2>
                    <p className="text-sm text-gray-400">Manage your subscription and billing</p>
                  </div>

                  {/*
                    Access, not the literal string 'active'.

                    This tested status === 'active' alone, so a trialing
                    subscription fell into the "No Active Subscription" branch -
                    while the details panel directly below read the status field
                    and said "Trialing". The same screen contradicted itself, and
                    worse, the Cancel Subscription button lives in this branch, so
                    a user on a trial had no way to cancel from the app at all.

                    evaluateSubscriptionAccess is the same function the paywall
                    uses and mirrors has_active_subscription() in the database, so
                    this screen now agrees with what actually grants access:
                    trialing counts, and so does a cancelled subscription whose
                    paid period has not run out yet.
                  */}
                  {subscription && subscriptionAccess?.hasAccess ? (
                    <div className="bg-gradient-to-br from-gold-400/10 to-transparent border border-gold-400/20 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">TradeX Pro</h3>
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full">
                              Active
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">Unlimited trades, advanced analytics, Nova AI</p>
                        </div>
                        <p className="text-2xl font-bold text-gold-400">$24.99<span className="text-sm text-gray-400">/mo</span></p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Check size={16} className="text-blue-400" />
                          <span className="text-gray-300">Unlimited broker connections</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check size={16} className="text-blue-400" />
                          <span className="text-gray-300">Advanced analytics and reports</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check size={16} className="text-blue-400" />
                          <span className="text-gray-300">Nova AI assistant</span>
                        </div>
                      </div>

                      {subscription.status === 'trialing' && subscription.current_period_end && (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-sm text-blue-300">
                            Trial ends on {new Date(subscription.current_period_end).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {subscription.current_period_end && (
                        <div className="mb-4 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                          <p className="text-sm text-gray-300">
                            Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      <div className="pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-400 mb-3">
                          Use the billing portal to update your payment method, view invoices, or manage your subscription.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleManageBilling}
                            disabled={subLoading}
                            icon={<ExternalLink size={16} />}
                          >
                            {subLoading ? 'Loading...' : 'Manage Billing'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCancelSubscription}
                            disabled={subLoading}
                          >
                            {subLoading ? 'Processing...' : 'Cancel Subscription'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-gray-500/10 to-transparent border border-gray-500/20 rounded-xl p-6">
                      {/*
                        This was an "Activate Subscription (Testing)" button
                        offering a free 30-day subscription. The endpoint behind
                        it was locked down to require real Stripe verification,
                        so it could only ever fail - but it was still sitting in
                        Settings, shown to every user without a subscription,
                        offering something it could not deliver. It now points at
                        the real checkout.
                      */}
                      <div className="text-center py-8">
                        <CreditCard size={48} className="mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-white mb-2">No Active Subscription</h3>
                        <p className="text-sm text-gray-400 mb-6">
                          Subscribe to unlock your journal, analytics and Nova.
                        </p>
                        <Button onClick={() => navigate('/payment')}>
                          View plans
                        </Button>
                        <p className="text-xs text-gray-500 mt-3">
                          7-day free trial &middot; cancel anytime
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border border-white/10 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Subscription Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status</span>
                        <span className="text-white font-medium">
                          {subscription?.status ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1) : 'No subscription'}
                        </span>
                      </div>
                      {subscription?.status === 'trialing' && subscription?.current_period_end && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trial Ends</span>
                          <span className="text-white font-medium">
                            {new Date(subscription.current_period_end).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {subscription?.current_period_end && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Period Ends</span>
                          <span className="text-white font-medium">
                            {new Date(subscription.current_period_end).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Display Preferences</h2>
                    <p className="text-sm text-gray-400">Customize your experience</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-300 mb-2">
                        Timezone
                      </label>
                      <select
                        id="timezone"
                        value={preferences.timezone}
                        onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      >
                        <option value="UTC">UTC+0:00 - Coordinated Universal Time</option>
                        <option value="Pacific/Midway">UTC-11:00 - Midway Island, Samoa</option>
                        <option value="Pacific/Honolulu">UTC-10:00 - Hawaii</option>
                        <option value="America/Anchorage">UTC-9:00 - Alaska</option>
                        <option value="America/Los_Angeles">UTC-8:00 - Pacific Time (US & Canada)</option>
                        <option value="America/Denver">UTC-7:00 - Mountain Time (US & Canada)</option>
                        <option value="America/Chicago">UTC-6:00 - Central Time (US & Canada)</option>
                        <option value="America/New_York">UTC-5:00 - Eastern Time (US & Canada)</option>
                        <option value="America/Caracas">UTC-4:00 - Caracas, La Paz</option>
                        <option value="America/Argentina/Buenos_Aires">UTC-3:00 - Buenos Aires, Georgetown</option>
                        <option value="America/Noronha">UTC-2:00 - Mid-Atlantic</option>
                        <option value="Atlantic/Azores">UTC-1:00 - Azores, Cape Verde Islands</option>
                        <option value="Europe/London">UTC+0:00 - London, Dublin, Lisbon</option>
                        <option value="Europe/Paris">UTC+1:00 - Paris, Berlin, Rome</option>
                        <option value="Europe/Athens">UTC+2:00 - Athens, Cairo, Jerusalem</option>
                        <option value="Europe/Moscow">UTC+3:00 - Moscow, St. Petersburg</option>
                        <option value="Asia/Dubai">UTC+4:00 - Abu Dhabi, Dubai, Muscat</option>
                        <option value="Asia/Karachi">UTC+5:00 - Islamabad, Karachi, Tashkent</option>
                        <option value="Asia/Dhaka">UTC+6:00 - Dhaka, Almaty</option>
                        <option value="Asia/Bangkok">UTC+7:00 - Bangkok, Hanoi, Jakarta</option>
                        <option value="Asia/Singapore">UTC+8:00 - Singapore, Hong Kong, Beijing</option>
                        <option value="Asia/Tokyo">UTC+9:00 - Tokyo, Seoul, Osaka</option>
                        <option value="Australia/Sydney">UTC+10:00 - Sydney, Melbourne, Brisbane</option>
                        <option value="Pacific/Noumea">UTC+11:00 - Solomon Islands, New Caledonia</option>
                        <option value="Pacific/Auckland">UTC+12:00 - Auckland, Wellington, Fiji</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-300 mb-2">
                        Currency
                      </label>
                      <select
                        id="currency"
                        value={preferences.currency}
                        onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-300 mb-2">
                        Date Format
                      </label>
                      <select
                        id="dateFormat"
                        value={preferences.dateFormat}
                        onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Button
                      onClick={handleSavePreferences}
                      disabled={loading}
                      icon={saveSuccess ? <Check size={16} /> : <Save size={16} />}
                      className={saveSuccess ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      {saveSuccess ? 'Saved!' : loading ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>

                  {/*
                    Replaying the tour had no entry point anywhere in the app.
                    restartTour() existed in the context but was wired to
                    nothing, so anyone who pressed skip - or finished it and
                    later wanted a reminder - could never see it again short of
                    someone editing tour_completed in the database by hand.
                  */}
                  <div className="mt-10 pt-8 border-t border-white/10">
                    <h3 className="text-base font-semibold text-white mb-1">Product tour</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Take the quick walkthrough again &mdash; the journal, Nova, and where your
                      results show up. Takes about a minute.
                    </p>
                    <Button variant="secondary" onClick={handleReplayTour} icon={<Play size={16} />}>
                      Replay tour
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Contact Us</h2>
                    <p className="text-sm text-gray-400">Need help? Get in touch with our support team</p>
                  </div>

                  <div className="space-y-4">
                    {/*
                      The form comes first, and email second. Reporting from
                      inside the app carries the page and browser with it;
                      email is the fallback for anything that does not fit a
                      bug report, or for someone who cannot sign in.
                    */}
                    <SupportReportForm />

                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Mail className="text-blue-400" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-white mb-1">Email Support</h3>
                          <p className="text-sm text-gray-400 mb-3">
                            Have questions, feedback, or need assistance? We're here to help!
                          </p>
                          <a
                            href="mailto:tradenovaai@gmail.com"
                            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                          >
                            <Mail size={16} />
                            tradenovaai@gmail.com
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="border border-white/10 bg-white/[0.02] rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-white mb-3">What can we help you with?</h3>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Technical support and troubleshooting</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Account and billing inquiries</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Importing trades and CSV statements</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Feature requests and feedback</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>General questions about TradeX</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                      <p className="text-xs text-gray-400">
                        We typically respond within 24-48 hours during business days. For urgent matters, please include "URGENT" in your subject line.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeTab === 'personal' && (
              <motion.section variants={fadeInUp} className="mt-6 space-y-4" data-tour="settings-brokers">
                <h2 className="text-xl font-semibold text-white">Trading Accounts</h2>
                <div className="bg-[#111]/80 backdrop-blur-sm border border-white/[0.05] rounded-2xl p-6">
                  <BrokerConnectionsList />
                </div>
              </motion.section>
            )}
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancel Subscription"
        message="Are you sure you want to cancel? You will continue to have access until the end of your billing period."
        confirmLabel="Cancel Subscription"
        variant="warning"
        onConfirm={executeCancelSubscription}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}