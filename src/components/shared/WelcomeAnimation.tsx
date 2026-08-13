import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface WelcomeAnimationProps {
  firstName: string;
  isFirstTime?: boolean;
  onComplete?: () => void;
}

export default function WelcomeAnimation({ firstName, isFirstTime = false, onComplete }: WelcomeAnimationProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => onComplete?.(), 2000);
    }, 4500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
        >
          <div className="text-center overflow-hidden">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                backgroundPosition: ['200% center', '-200% center']
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 2 },
                backgroundPosition: {
                  duration: 10,
                  delay: 1.5,
                  ease: "linear"
                }
              }}
              className="text-3xl md:text-5xl font-medium bg-gradient-to-r from-white/20 via-white to-white/20 bg-clip-text text-transparent bg-[length:200%_auto]"
              style={{ backgroundPosition: '200% center' }}
            >
              {isFirstTime ? 'Welcome' : 'Welcome Back'}, {firstName}
            </motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
