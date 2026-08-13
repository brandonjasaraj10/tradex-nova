import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-dark-700 flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <Logo className="h-16 w-16" />
        <h1 className="mt-6 text-2xl font-bold text-gold-400">
          Loading TradeX
        </h1>
      </motion.div>
      
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: '60%' }}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="mt-8 h-1 bg-gradient-to-r from-gold-500 to-gold-300 rounded-full"
      />
      
      <p className="mt-4 text-gray-400 text-sm">Preparing your trading environment...</p>
    </div>
  );
}