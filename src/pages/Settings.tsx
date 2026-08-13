import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ConfirmModal from '../components/shared/ConfirmModal';
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
  ExternalLink
} from 'lucide-react';
import Button from '../components/shared/Button';
import BrokerConnectionsList from '../components/broker/BrokerConnectionsList';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { usePreferences } from '../lib/preferencesContext';

interface UserProfile {
  first_name: string;
  last_name: string;
}

interface Subscription {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { refreshPreferences } = usePreferences();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
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

  const [preferences, setPreferences] = useState({
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY'
  });

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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
        .eq('id', user.id)
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
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleActivateSubscription = async () => {
    setSubLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to activate subscription');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'activate',
          duration: 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate subscription');
      }

      await loadSubscription();
      alert('Subscription activated successfully!');
    } catch (err) {
      console.error('Activation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubLoading(false);
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

  const handleSaveProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
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
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match');
      return;
    }

    if (passwords.new.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      setPasswords({ current: '', new: '', confirm: '' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password');
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
          id: user.id,
          timezone: preferences.timezone,
          currency: preferences.currency,
          date_format: preferences.dateFormat,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
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
                      className={saveSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
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

                  <div className="pt-4">
                    <Button
                      onClick={handleChangePassword}
                      disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                      icon={<Shield size={16} />}
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Subscription</h2>
                    <p className="text-sm text-gray-400">Manage your subscription and billing</p>
                  </div>

                  {subscription && subscription.status === 'active' ? (
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

                      {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-sm text-blue-300">
                            Trial ends on {new Date(subscription.trial_end).toLocaleDateString()}
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
                      <div className="text-center py-8">
                        <CreditCard size={48} className="mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-white mb-2">No Active Subscription</h3>
                        <p className="text-sm text-gray-400 mb-6">
                          Activate your subscription to access all premium features
                        </p>
                        <Button
                          onClick={handleActivateSubscription}
                          disabled={subLoading}
                        >
                          {subLoading ? 'Activating...' : 'Activate Subscription (Testing)'}
                        </Button>
                        <p className="text-xs text-gray-500 mt-3">
                          This will activate a 30-day subscription for testing
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
                      {subscription?.trial_end && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trial Ends</span>
                          <span className="text-white font-medium">
                            {new Date(subscription.trial_end).toLocaleDateString()}
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
                      className={saveSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {saveSuccess ? 'Saved!' : loading ? 'Saving...' : 'Save Preferences'}
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
                          <span>Broker connection assistance</span>
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