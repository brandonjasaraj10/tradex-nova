import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, TrendingUp, Target, Brain, Zap, Clock, Globe } from 'lucide-react';
import { userProfileService, ProfileCreationData } from '../../services/userProfileService';
import { useToast } from '../../lib/toastContext';

interface PersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

interface FormData {
  preferred_markets: string[];
  trading_approach: string;
  risk_tolerance: string;
  experience_level: string;
  typical_trade_duration: string;
  preferred_sessions: string[];
  trading_goals: string;
  focus_areas: string[];
}

const steps = [
  { id: 1, title: 'Experience', icon: TrendingUp },
  { id: 2, title: 'Trading Style', icon: Target },
  { id: 3, title: 'Markets & Sessions', icon: Globe },
  { id: 4, title: 'Goals & Focus', icon: Brain },
];

export default function PersonalizationModal({ isOpen, onClose, onComplete, userId }: PersonalizationModalProps) {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    preferred_markets: [],
    trading_approach: '',
    risk_tolerance: '',
    experience_level: '',
    typical_trade_duration: '',
    preferred_sessions: [],
    trading_goals: '',
    focus_areas: []
  });

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'preferred_markets' | 'preferred_sessions' | 'focus_areas', item: string) => {
    const current = formData[field];
    if (current.includes(item)) {
      updateFormData(field, current.filter(i => i !== item));
    } else {
      updateFormData(field, [...current, item]);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const profileData: ProfileCreationData = {
        preferred_markets: formData.preferred_markets,
        trading_approach: formData.trading_approach,
        risk_tolerance: formData.risk_tolerance,
        experience_level: formData.experience_level,
        typical_trade_duration: formData.typical_trade_duration,
        preferred_sessions: formData.preferred_sessions,
        trading_goals: formData.trading_goals || undefined,
        focus_areas: formData.focus_areas
      };

      await userProfileService.createOrUpdateProfile(userId, profileData);
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('Could not save your profile. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.experience_level !== '' && formData.risk_tolerance !== '';
      case 2:
        return formData.trading_approach !== '' && formData.typical_trade_duration !== '';
      case 3:
        return formData.preferred_markets.length > 0;
      case 4:
        return formData.focus_areas.length > 0;
      default:
        return false;
    }
  };

  /*
    Hold the page still while this is open.

    Without it a drag inside the dialog scrolls the page behind it instead -
    on a phone that reads as the dialog being stuck while the background
    slides around underneath. Restores whatever overflow the body had rather
    than assuming it was the default, so nothing else that sets it is trampled.
  */
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        /*
          The card had no height limit, so on a short screen its content ran
          past the bottom of the display and overflow-hidden simply cut it off
          - there was no way to reach the buttons. It is now capped to the
          viewport and laid out as a column so the middle section scrolls
          while the header and footer stay put. dvh rather than vh because
          mobile browsers count their own toolbars in vh, which leaves the
          footer just under the edge of the screen.
        */
        className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Personalize Your Nova Insights</h2>
                <p className="text-sm text-gray-400">Help Nova understand your trading style</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-blue-400/20 border border-blue-400/30'
                          : isCompleted
                          ? 'bg-blue-400/10 border border-blue-400/20'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-blue-400" />
                      ) : (
                        <StepIcon
                          className={`w-5 h-5 ${
                            isActive ? 'text-blue-400' : 'text-gray-500'
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 ${
                        isActive ? 'text-white font-medium' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-px bg-white/10 mx-2 mt-[-20px]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-y-auto sm:min-h-[400px]">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What's your trading experience level?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'beginner', label: 'Beginner', desc: 'Just getting started' },
                      { value: 'intermediate', label: 'Intermediate', desc: '1-2 years experience' },
                      { value: 'advanced', label: 'Advanced', desc: '3+ years experience' },
                      { value: 'expert', label: 'Expert', desc: 'Professional trader' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateFormData('experience_level', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.experience_level === option.value
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What's your risk tolerance?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'low', label: 'Conservative', desc: 'Protect capital first' },
                      { value: 'medium', label: 'Moderate', desc: 'Balanced approach' },
                      { value: 'high', label: 'Aggressive', desc: 'Growth focused' },
                      { value: 'very_high', label: 'Very Aggressive', desc: 'Maximum returns' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateFormData('risk_tolerance', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.risk_tolerance === option.value
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What's your primary trading approach?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'scalping', label: 'Scalping', desc: 'Quick trades, minutes' },
                      { value: 'day_trading', label: 'Day Trading', desc: 'Intraday positions' },
                      { value: 'swing_trading', label: 'Swing Trading', desc: 'Multi-day holds' },
                      { value: 'position_trading', label: 'Position Trading', desc: 'Long-term holds' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateFormData('trading_approach', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.trading_approach === option.value
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    How long do you typically hold trades?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'minutes', label: 'Minutes', desc: 'Scalping style' },
                      { value: 'hours', label: 'Hours', desc: 'Intraday trading' },
                      { value: 'days', label: 'Days', desc: 'Swing trading' },
                      { value: 'weeks_or_more', label: 'Weeks or More', desc: 'Position trading' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateFormData('typical_trade_duration', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.typical_trade_duration === option.value
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Which markets do you trade? (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'forex', label: 'Forex', desc: 'Currency pairs' },
                      { value: 'stocks', label: 'Stocks', desc: 'Equities' },
                      { value: 'crypto', label: 'Crypto', desc: 'Digital currencies' },
                      { value: 'indices', label: 'Indices', desc: 'Market indices' },
                      { value: 'commodities', label: 'Commodities', desc: 'Gold, oil, etc.' },
                      { value: 'futures', label: 'Futures', desc: 'Futures contracts' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayItem('preferred_markets', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.preferred_markets.includes(option.value)
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-white">{option.label}</div>
                          {formData.preferred_markets.includes(option.value) && (
                            <Check className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    Which trading sessions do you prefer? (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'asian', label: 'Asian', desc: 'Tokyo session' },
                      { value: 'london', label: 'London', desc: 'European session' },
                      { value: 'new_york', label: 'New York', desc: 'US session' },
                      { value: 'sydney', label: 'Sydney', desc: 'Pacific session' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayItem('preferred_sessions', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.preferred_sessions.includes(option.value)
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-white">{option.label}</div>
                          {formData.preferred_sessions.includes(option.value) && (
                            <Check className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What areas do you want to focus on? (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'psychology', label: 'Psychology', desc: 'Mental game' },
                      { value: 'risk_management', label: 'Risk Management', desc: 'Protect capital' },
                      { value: 'strategy', label: 'Strategy', desc: 'Improve edge' },
                      { value: 'discipline', label: 'Discipline', desc: 'Follow rules' },
                      { value: 'analysis', label: 'Analysis', desc: 'Better decisions' },
                      { value: 'journaling', label: 'Journaling', desc: 'Track progress' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayItem('focus_areas', option.value)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          formData.focus_areas.includes(option.value)
                            ? 'bg-blue-400/10 border-blue-400/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-white">{option.label}</div>
                          {formData.focus_areas.includes(option.value) && (
                            <Check className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">
                    What are your trading goals? (Optional)
                  </label>
                  <textarea
                    value={formData.trading_goals}
                    onChange={(e) => updateFormData('trading_goals', e.target.value)}
                    placeholder="e.g., Become consistently profitable, grow my account by 20%, master risk management..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50 transition-colors resize-none"
                    rows={4}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 sm:p-6 border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="hidden sm:flex items-center gap-2">
            {steps.map(step => (
              <div
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  currentStep >= step.id ? 'w-8 bg-blue-400' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>

          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 border border-blue-400/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl text-sm font-medium bg-blue-400 text-black hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
            >
              {isSubmitting ? 'Saving...' : 'Complete Setup'}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
