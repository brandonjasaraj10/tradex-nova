import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Save, Loader, Check } from 'lucide-react';
import Card from '../components/shared/Card';
import Button from '../components/shared/Button';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || !firstName.trim()) return;

    setLoading(true);
    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();
      setSaveStatus('saved');

      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };
  
  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
      >
        <motion.div variants={fadeInUp} className="mb-6 pt-4">
          <h1 className="text-2xl font-bold mb-2">Profile</h1>
          <p className="text-gray-400">Manage your personal information</p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card variant="default" className="bg-[#111]/80 p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <User size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-medium">
                    {firstName} {lastName}
                  </h2>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
                    placeholder="Enter your first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <div className="flex items-center gap-3 px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-gray-400">
                  <Mail size={18} />
                  <span>{user?.email}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Member Since
                </label>
                <div className="flex items-center gap-3 px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-gray-400">
                  <Calendar size={18} />
                  <span>{formatDate(user?.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={loading || !firstName.trim()}
                  icon={
                    saveStatus === 'saving' ? (
                      <Loader size={16} className="animate-spin" />
                    ) : saveStatus === 'saved' ? (
                      <Check size={16} />
                    ) : (
                      <Save size={16} />
                    )
                  }
                >
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'saved'
                    ? 'Saved'
                    : 'Save Changes'}
                </Button>

                {saveStatus === 'error' && (
                  <span className="text-sm text-danger-400">
                    Failed to save changes
                  </span>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="mt-6">
          <Card variant="default" className="bg-[#111]/80 p-6">
            <h3 className="text-lg font-medium mb-4">Account Information</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">Account ID</span>
                <span className="font-mono text-xs">{user?.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">Last Updated</span>
                <span>{formatDate(profile?.updated_at)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Account Status</span>
                <span className="text-success-400">Active</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}