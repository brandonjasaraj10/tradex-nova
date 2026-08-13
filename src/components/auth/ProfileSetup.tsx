import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

interface ProfileSetupProps {
  user: User;
  onComplete: () => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Try to refresh the session first
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        // If refresh fails, try to get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!currentSession) {
          setError('Your session has expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/auth';
          }, 2000);
          return;
        }
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Profile error details:', profileError);
        throw new Error(profileError.message || 'Database error');
      }

      onComplete();
    } catch (err) {
      console.error('Error creating profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

      // Check if it's a JWT error
      if (errorMessage.includes('JWT') || errorMessage.includes('expired')) {
        setError('Your session has expired. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
      } else {
        setError(`Failed to save profile: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full mx-4"
      >
        <div className="text-center mb-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-2xl md:text-3xl font-medium mb-3"
          >
            Complete Your Profile
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-gray-400"
          >
            Help us personalize your experience
          </motion.p>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label htmlFor="firstName" className="block text-sm text-gray-400 mb-2">
              First Name *
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Brandon"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm text-gray-400 mb-2">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Optional"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !firstName.trim()}
            className="w-full bg-white text-black rounded-2xl px-4 py-3 font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </motion.form>
      </motion.div>
    </div>
  );
}
