import React from 'react';
import { motion } from 'framer-motion';

interface TradeXScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function TradeXScore({ 
  score, 
  size = 'md', 
  showLabel = true 
}: TradeXScoreProps) {
  // Calculate color based on score
  const getColor = (value: number) => {
    if (value < 40) return '#EF4444'; // danger
    if (value < 70) return '#F59E0B'; // warning
    return '#10B981'; // success
  };
  
  // Calculate size based on size prop
  const getSizeClass = (size: string) => {
    switch (size) {
      case 'sm': return 'w-16 h-16 text-xl';
      case 'lg': return 'w-32 h-32 text-4xl';
      default: return 'w-24 h-24 text-3xl';
    }
  };

  const sizeClass = getSizeClass(size);
  const scoreColor = getColor(score);
  
  // Calculate percentage for the progress ring
  const radius = size === 'sm' ? 25 : size === 'lg' ? 60 : 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClass} flex items-center justify-center`}>
        {/* Background Circle */}
        <svg className="absolute w-full h-full" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#2D2D2D"
            strokeWidth="8"
          />
        </svg>
        
        {/* Progress Circle */}
        <motion.svg 
          className="absolute w-full h-full -rotate-90"
          viewBox="0 0 120 120"
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: -90 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
          />
        </motion.svg>
        
        {/* Score Text */}
        <motion.div 
          className="flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <span 
            className="font-bold" 
            style={{ color: scoreColor }}
          >
            {score}
          </span>
        </motion.div>
      </div>
      
      {showLabel && (
        <motion.p 
          className="mt-2 text-sm font-medium text-gold-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          TradeX Score
        </motion.p>
      )}
    </div>
  );
}