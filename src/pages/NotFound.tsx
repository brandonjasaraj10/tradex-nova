import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, ArrowLeft } from 'lucide-react';
import Button from '../components/shared/Button';

export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="mb-6 flex justify-center">
          <div className="w-24 h-24 bg-dark-400 rounded-full flex items-center justify-center">
            <LineChart className="w-12 h-12 text-gold-400" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gold-400 mb-4">Page Not Found</h2>
        
        <p className="text-gray-400 mb-8">
          The trading chart you're looking for seems to have dipped off the map. 
          Let's navigate back to more profitable territory.
        </p>
        
        <Button
          onClick={() => navigate('/')}
          variant="primary"
          size="lg"
          icon={<ArrowLeft size={16} />}
        >
          Back to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}