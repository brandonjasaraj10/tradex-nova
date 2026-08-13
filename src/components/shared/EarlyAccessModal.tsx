import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import Button from './Button';

interface EarlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EarlyAccessModal({ isOpen, onClose, onSuccess }: EarlyAccessModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const correctCode = import.meta.env.VITE_EARLY_ACCESS_CODE;

    if (code.toUpperCase() === correctCode) {
      localStorage.setItem('tradex_early_access', 'granted');
      setIsLoading(false);
      onSuccess();
    } else {
      setError('Invalid access code. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-dark-700 border border-white/10 rounded-2xl p-6 max-w-md w-full relative"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Lock className="text-blue-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Early Access</h2>
                  <p className="text-sm text-gray-400">Enter your access code</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setError('');
                    }}
                    className="input-field text-center text-lg tracking-wider font-mono uppercase"
                    placeholder="ENTER CODE"
                    required
                  />
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm text-red-400"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading}
                >
                  Verify Code
                </Button>
              </form>

              <p className="mt-4 text-xs text-center text-gray-500">
                Don't have an access code? Join our waitlist to be notified when we launch.
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
