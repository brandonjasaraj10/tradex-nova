import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';

export default function SplashScreen() {
  const [showNova, setShowNova] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNova(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-dark-700 flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Logo className="h-24 w-24" />
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 text-4xl font-bold"
        >
          <span className="shimmer-effect">TradeX</span>
        </motion.h1>
        
        <AnimatePresence>
          {showNova && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="mt-4 text-xl text-gold-400"
            >
              NOVA Awaits
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}