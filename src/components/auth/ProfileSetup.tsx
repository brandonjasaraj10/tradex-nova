import { useState } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';
import MascotSays from '../shared/MascotSays';

interface ProfileSetupProps {
  user: User;
  onComplete: () => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  // Mounted only while showing.
  useBodyScrollLock(true);
  const [firstName, setFirstName] = useState('');
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
          user_id: user.id,
          first_name: firstName.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Profile error details:', profileError);
        throw new Error(profileError.message || 'Database error');
      }

      onComplete();
    } catch (err) {
      console.error('Error creating profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

      /*
        Two ways this screen can be unreachable-but-displayed, and both are
        the same problem: a token the browser still believes in, for an
        account the server no longer has.

        An expired JWT was already handled. The other is a foreign key
        violation on user_profiles.user_id, which means the auth.users row
        is simply gone - the account was deleted somewhere else, in another
        tab or by an administrator, while this session stayed open. It is
        not a save failure and retrying cannot fix it: every attempt writes
        a user_id that no longer refers to anybody.

        Left alone it is a trap. This screen has no sign-out, so the raw
        Postgres constraint name sat on screen and the only way forward was
        clearing site data by hand.

        signOut() before redirecting, which the JWT branch did not do -
        redirecting alone leaves the dead token in localStorage, so the next
        load signs straight back in as the same missing user and lands right
        back here.
      */
      const sessionIsDead =
        errorMessage.includes('JWT') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('user_profiles_user_id_fkey') ||
        errorMessage.includes('foreign key constraint');

      if (sessionIsDead) {
        setError('Your session is no longer valid. Taking you back to sign in...');
        try {
          await supabase.auth.signOut();
        } catch {
          /* Signing out of a session the server has forgotten can itself
             fail; clearing the browser's copy is what actually matters. */
        }
        setTimeout(() => {
          window.location.href = '/auth';
        }, 1500);
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
        className="max-w-md w-full mx-4 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        {/*
          He opens here, not one screen later.

          This is the first thing anybody sees after signing up, and it was
          the only screen in the sequence with no character, no logo and no
          voice - "Complete Your Profile / Help us personalize your
          experience", which is the boilerplate every SaaS ships. The flow
          behind it greets people, asks in plain language and looks like a
          product; arriving at THIS first made all of that start one screen
          too late. Traffic from a video is mobile, cold and one tap from
          leaving, so the first impression is the one worth spending on.

          The same component and pose the next screen uses, so the two read
          as one conversation rather than two designs.
        */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <MascotSays pose="wave" height={84} side="above" className="mb-7">
            Welcome in. What should I call you?
          </MascotSays>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            {/*
              Visible label removed, not the label itself. "First Name *"
              above a box already saying "First name" is the same word twice
              and a required marker on the only field on screen. It stays in
              the DOM for screen readers, which is the part that was doing
              real work.
            */}
            <label htmlFor="firstName" className="sr-only">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              /*
                autoComplete and autoCapitalize because this is a phone: the
                keyboard should offer their own name and capitalise it
                without being asked.
              */
              autoComplete="given-name"
              autoCapitalize="words"
              className="w-full bg-brand-surface border border-white/10 rounded-2xl px-5 py-4 text-[16px]
                text-white placeholder:text-gray-600
                focus:outline-none focus:border-brand-blue-light/50 transition-colors"
              placeholder="First name"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/*
            Last Name removed.

            It was written to the profile on signup and read back by
            nothing: the header greets you by first name, the abandoned
            email personalises on first name, and Settings is the only other
            place it appeared. A field whose only consumer is its own
            storage is a field worth not asking for, on the screen where
            every extra input costs signups.
          */}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/*
            Matches the button that ends the flow - same pill, same white,
            same weight - so the first tap and the last look like the same
            product. py-4 rather than py-3 for a thumb.
          */}
          <button
            type="submit"
            disabled={isSubmitting || !firstName.trim()}
            className="w-full bg-white text-black rounded-full px-5 py-4 text-[15px] font-medium
              hover:bg-gray-200 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving\u2026' : 'Continue'}
          </button>
        </motion.form>
      </motion.div>
    </div>
  );
}
