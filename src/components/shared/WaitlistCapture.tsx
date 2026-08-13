import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WaitlistCaptureProps {
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  buttonText?: string;
  variant?: 'inline' | 'stacked';
  className?: string;
}

export default function WaitlistCapture({
  size = 'md',
  placeholder = 'Enter your email',
  buttonText,
  variant = 'inline',
  className = ''
}: WaitlistCaptureProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { error: supabaseError } = await supabase
        .from('waitlist')
        .insert({ email: email.trim().toLowerCase() });

      if (supabaseError) {
        console.error('Waitlist insert error details:', {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint
        });

        if (supabaseError.code === '23505') {
          setSubmitted(true);
          setTimeout(() => {
            setSubmitted(false);
            setEmail('');
          }, 5000);
        } else {
          setError(`Error: ${supabaseError.message}`);
        }
      } else {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setEmail('');
        }, 5000);
      }
    } catch (err) {
      console.error('Waitlist error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeClasses = {
    sm: 'text-sm py-2 px-3',
    md: 'text-base py-3 px-4',
    lg: 'text-lg py-4 px-5'
  };

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizeClasses = {
    sm: 16,
    md: 20,
    lg: 24
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-white/5 rounded-2xl p-6 ${className}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
          className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-gold-400" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xl font-medium mb-2 text-white">You're on the list!</h3>
          <p className="text-white/60">
            We'll notify you when we launch.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  if (variant === 'stacked') {
    return (
      <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-[#0A0A0A] border border-white/10 rounded-2xl text-white placeholder:text-white/40 ${sizeClasses[size]} focus:outline-none focus:border-gold-400/50 transition-colors`}
            required
            disabled={isSubmitting}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className={`w-full bg-gold-400 hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-2xl ${sizeClasses[size]} transition-colors flex items-center justify-center gap-2`}
        >
          {isSubmitting ? 'Joining...' : (buttonText || 'Join Waitlist')}
          <Send size={iconSizeClasses[size]} />
        </button>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-blue-400"
          >
            {error}
          </motion.p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0A0A0A] border border-white/10 rounded-2xl text-white placeholder:text-white/40 ${sizeClasses[size]} pr-14 focus:outline-none focus:border-gold-400/50 transition-colors`}
        required
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={isSubmitting || !email}
        className={`absolute right-2 top-1/2 -translate-y-1/2 ${buttonSizeClasses[size]} hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Send size={iconSizeClasses[size]} className="text-gold-400" />
      </button>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-6 left-0 text-xs text-blue-400"
        >
          {error}
        </motion.p>
      )}
    </form>
  );
}
