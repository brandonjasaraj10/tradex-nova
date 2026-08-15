import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/shared/ConfirmModal';
import { Mic, Send, Sparkles, Trash2, RotateCw, TrendingUp, Brain, Zap, Target, Clock, LineChart, Activity, DollarSign, BarChart2, AlertCircle, CheckCircle2, Flame, Award, BookOpen, Volume2, VolumeX, Settings, History, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNova } from '../lib/novaContext';
import { useNavigate } from 'react-router-dom';
import { useVoice } from '../hooks/useVoice';
import { useTour } from '../lib/tourContext';
import { useAuth } from '../lib/auth';
import { userProfileService } from '../services/userProfileService';
import { formatNovaMessage } from '../utils/formatNovaMessage';
import PersonalizationModal from '../components/nova/PersonalizationModal';
import ConversationArchive from '../components/nova/ConversationArchive';
import { generateInsights, getActiveInsights, dismissInsight, type Insight } from '../services/insights';
import { generateTips, getActiveTips, dismissTip, type Tip } from '../services/tips';
import { correctTradingTerms } from '../utils/tradingVocabulary';
import { calculateNOVAScore, type NOVAScoreBreakdown } from '../services/novaScore';
import { getTradingRules, type TradingRule } from '../services/tradingRules';
import { supabase } from '../lib/supabase';

interface QuickAction {
  text: string;
  query: string;
  icon: any;
}

const quickActions: QuickAction[] = [
  { text: 'Analyze Performance', query: 'Analyze my trading performance', icon: LineChart },
  { text: 'View Confluences', query: 'Show my trading confluences', icon: Target },
  { text: 'Find Patterns', query: 'What patterns have you detected?', icon: Brain },
  { text: 'My NOVA Score', query: 'What is my NOVA Score?', icon: Zap },
  { text: 'Recent Trades', query: 'Show me my recent trades', icon: TrendingUp },
  { text: 'Best Trading Times', query: 'When should I trade?', icon: Clock },
];

interface ActivityItem {
  action: string;
  time: string;
  icon: typeof LineChart;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export default function NovaAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tourCompleted } = useTour();
  const { messages, isTyping, isLoading, currentSessionId, sendMessage, clearHistory, startVoiceSession, loadSession, createNewSession, deleteSession, submitFeedback } = useNova();
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showPersonalizationModal, setShowPersonalizationModal] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [showPersonalizationPrompt, setShowPersonalizationPrompt] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [scoreBreakdown, setScoreBreakdown] = useState<NOVAScoreBreakdown | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [userTradingRules, setUserTradingRules] = useState<TradingRule[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageRef = useRef<string>('');
  const lastSpokenMessageIndexRef = useRef<number>(-1);

  const {
    isListening,
    isSpeaking,
    isSupported,
    isConversationMode,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    startConversation,
    stopConversation
  } = useVoice({
    onTranscript: (text) => {
      // Apply trading term corrections before setting input
      const correctedText = correctTradingTerms(text);
      setInput(correctedText);
      if (isConversationMode) {
        handleSubmit(correctedText);
      }
    }
  });

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    if (messages.length > 0 && !isConversationMode) {
      scrollToBottom();
    }
  }, [messages, isConversationMode]);

  useEffect(() => {
    if (messages.length > 1) {
      setShowSuggestions(false);
    }
  }, [messages]);

  useEffect(() => {
    const checkProfile = async () => {
      if (user) {
        const profileExists = await userProfileService.hasProfile(user.id);
        setHasProfile(profileExists);

        if (tourCompleted && !profileExists) {
          const hasSeenPrompt = localStorage.getItem('hasSeenPersonalizationPrompt');
          if (!hasSeenPrompt) {
            setShowPersonalizationPrompt(true);
          }
        }
      }
    };
    checkProfile();
  }, [user, tourCompleted]);

  useEffect(() => {
    const loadInsights = async () => {
      if (user) {
        setLoadingInsights(true);
        try {
          const existingInsights = await getActiveInsights(user.id);
          if (existingInsights.length > 0) {
            setInsights(existingInsights);
          } else {
            const newInsights = await generateInsights(user.id, false);
            setInsights(newInsights);
          }
        } catch (error) {
          console.error('Error loading insights:', error);
        } finally {
          setLoadingInsights(false);
        }
      }
    };

    loadInsights();
  }, [user]);

  useEffect(() => {
    const loadTips = async () => {
      if (user) {
        setLoadingTips(true);
        try {
          const existingTips = await getActiveTips(user.id);
          if (existingTips.length > 0) {
            setTips(existingTips);
          } else {
            const newTips = await generateTips(user.id, false);
            setTips(newTips);
          }
        } catch (error) {
          console.error('Error loading tips:', error);
        } finally {
          setLoadingTips(false);
        }
      }
    };

    loadTips();
  }, [user]);

  useEffect(() => {
    const loadStatsAndActivity = async () => {
      if (!user) return;
      setStatsLoading(true);
      try {
        const [{ data: tradesData }, { data: journalData }] = await Promise.all([
          supabase
            .from('trades')
            .select('pnl, entry_date, exit_date, created_at')
            .eq('user_id', user.id)
            .order('entry_date', { ascending: false })
            .limit(100),
          supabase
            .from('journal_entries')
            .select('id, title, entry_type, manual_pnl, entry_date, created_at')
            .eq('user_id', user.id)
            .not('manual_pnl', 'is', null)
            .order('entry_date', { ascending: false })
            .limit(100),
        ]);

        const tradeItems = (tradesData || []).map((t: any) => ({
          profit_loss: t.pnl || 0,
          entry_time: t.entry_date || t.created_at,
          exit_time: t.exit_date || t.entry_date || t.created_at,
        }));

        const journalItems = (journalData || []).map((e: any) => ({
          profit_loss: e.manual_pnl || 0,
          entry_time: e.entry_date || e.created_at,
          exit_time: e.entry_date || e.created_at,
        }));

        const allTrades = [...tradeItems, ...journalItems];
        setScoreBreakdown(allTrades.length > 0 ? await calculateNOVAScore(allTrades) : null);

        const { data: recentEntries } = await supabase
          .from('journal_entries')
          .select('id, title, entry_type, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        setRecentActivity(
          (recentEntries || []).map((e: any) => ({
            action: e.entry_type === 'psychology' ? `Logged psychology entry: ${e.title}` : `Logged trade entry: ${e.title}`,
            time: formatRelativeTime(e.created_at),
            icon: e.entry_type === 'psychology' ? Brain : LineChart,
          }))
        );

        setUserTradingRules(await getTradingRules(user.id));
      } catch (error) {
        console.error('Error loading stats/activity:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStatsAndActivity();
  }, [user]);

  useEffect(() => {
    if ((isConversationMode || autoSpeak) && messages.length > 0) {
      const lastMessageIndex = messages.length - 1;
      const lastMessage = messages[lastMessageIndex];

      if (
        lastMessage.role === 'assistant' &&
        lastMessageIndex !== lastSpokenMessageIndexRef.current &&
        !isSpeaking
      ) {
        lastSpokenMessageIndexRef.current = lastMessageIndex;
        lastMessageRef.current = lastMessage.content;
        speak(lastMessage.content);
      }
    }
  }, [messages, isConversationMode, autoSpeak, speak, isSpeaking]);

  const handleSubmit = async (messageText?: string) => {
    const userMessage = messageText || input.trim();
    if (!userMessage || isTyping) return;

    setShowSuggestions(false);
    setInput('');
    await sendMessage(userMessage);
  };

  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  const executeClearHistory = async () => {
    setShowClearConfirm(false);
    await clearHistory();
    lastMessageRef.current = '';
    lastSpokenMessageIndexRef.current = -1;
    setShowSuggestions(true);
  };

  const handleMicClick = () => {
    if (isConversationMode) {
      stopConversation();
      setIsVoiceMode(false);
      setAutoSpeak(false);
    } else {
      startVoiceSession();
      lastMessageRef.current = "Hey! I'm ready to chat. What would you like to know?";
      lastSpokenMessageIndexRef.current = 0;
      setIsVoiceMode(true);
      setAutoSpeak(true);
      startConversation();
    }
  };

  const handleSpeakerToggle = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setAutoSpeak(!autoSpeak);
  };

  const handlePersonalizationComplete = async () => {
    setShowPersonalizationModal(false);
    setHasProfile(true);
    setShowPersonalizationPrompt(false);
    localStorage.setItem('hasSeenPersonalizationPrompt', 'true');
  };

  const handleDismissInsight = async (insightId: string) => {
    try {
      await dismissInsight(insightId);
      setInsights(insights.filter(insight => insight.id !== insightId));
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const getInsightIconComponent = (type: string) => {
    const iconMap: Record<string, any> = {
      performance: Award,
      risk: AlertCircle,
      opportunity: Zap,
      pattern: Activity,
      discipline: CheckCircle2,
      psychology: Brain,
      consistency: Target
    };
    return iconMap[type] || Activity;
  };

  const getInsightColor = (category: string) => {
    const colorMap: Record<string, string> = {
      positive: 'text-blue-400',
      warning: 'text-blue-400',
      neutral: 'text-gray-400',
      critical: 'text-gray-400'
    };
    return colorMap[category] || 'text-gray-400';
  };

  const handleDismissTip = async (tipId: string) => {
    try {
      await dismissTip(tipId);
      setTips(tips.filter(tip => tip.id !== tipId));
    } catch (error) {
      console.error('Error dismissing tip:', error);
    }
  };

  const getTipIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Award: Award,
      Target: Target,
      TrendingUp: TrendingUp,
      Brain: Brain,
      CheckCircle2: CheckCircle2,
      Clock: Clock,
      Activity: Activity
    };
    return iconMap[iconName] || Award;
  };

  const handleDismissPersonalizationPrompt = () => {
    setShowPersonalizationPrompt(false);
    localStorage.setItem('hasSeenPersonalizationPrompt', 'true');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-blue-400/20 flex items-center justify-center border border-blue-400/20"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Sparkles className="w-8 h-8 text-blue-400" />
          </motion.div>
          <p className="text-sm text-gray-400">Initializing NOVA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-transparent to-blue-500/5 pointer-events-none" />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
          data-tour="nova-chat"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div
                className="relative w-14 h-14 rounded-2xl bg-blue-400/20 flex items-center justify-center border border-blue-400/30"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.5), 0 0 60px rgba(59, 130, 246, 0.3)',
                }}
              >
                <Sparkles className="w-7 h-7 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,1)]" />
              </motion.div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                  NOVA
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">Your AI Trading Assistant</p>
              </div>
            </div>

            {tourCompleted && (
              <div className="flex items-center gap-2">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowArchive(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                  title="View past conversations"
                >
                  <History className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">History</span>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPersonalizationModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/30 rounded-xl transition-colors"
                >
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">
                    {hasProfile ? 'Update Preferences' : 'Personalize Nova'}
                  </span>
                </motion.button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showPersonalizationPrompt && !hasProfile && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-blue-400/10 border border-blue-400/30 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-400/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-1">Personalize Your Nova Experience</h3>
                    <p className="text-xs text-gray-300 mb-3">
                      Help me understand your trading style so I can provide tailored insights and recommendations just for you.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowPersonalizationModal(true)}
                        className="px-4 py-2 bg-blue-400 hover:bg-blue-500 text-black text-sm font-medium rounded-lg transition-colors"
                      >
                        Get Started
                      </button>
                      <button
                        onClick={handleDismissPersonalizationPrompt}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        Maybe Later
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5"
              style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
              }}
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Trading Tips from NOVA
              </h3>
              <div className="space-y-3">
                {loadingTips ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <motion.div
                        className="w-8 h-8 mx-auto mb-2 rounded-lg bg-blue-400/20 flex items-center justify-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                      </motion.div>
                      <p className="text-xs text-gray-400">Loading tips...</p>
                    </div>
                  </div>
                ) : tips.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 mb-2">No tips available yet</p>
                    <p className="text-xs text-gray-500">Log trades to get personalized tips</p>
                  </div>
                ) : (
                  tips.slice(0, 2).map((tip) => {
                    const IconComponent = getTipIconComponent(tip.icon_name);
                    return (
                      <div key={tip.id} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5 group relative">
                        <IconComponent className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white mb-1">{tip.title}</h4>
                          <p className="text-xs text-gray-400">{tip.content}</p>
                        </div>
                        <button
                          onClick={() => handleDismissTip(tip.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          title="Dismiss tip"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5"
              style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
              }}
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Performance Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'NOVA Score', value: scoreBreakdown ? String(scoreBreakdown.overall_score) : '--', icon: Sparkles },
                  { label: 'Win Rate', value: scoreBreakdown ? `${scoreBreakdown.win_rate.toFixed(0)}%` : '--', icon: TrendingUp },
                  { label: 'Profit Factor', value: scoreBreakdown ? scoreBreakdown.profit_factor.toFixed(1) : '--', icon: DollarSign },
                  { label: 'Avg Win/Loss', value: scoreBreakdown ? `${scoreBreakdown.avg_win_loss_ratio.toFixed(1)}:1` : '--', icon: BarChart2 },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="bg-white/5 rounded-xl p-3 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                    <p className="text-xl font-bold text-white">{statsLoading ? '...' : stat.value}</p>
                  </motion.div>
                ))}
              </div>
              {!statsLoading && !scoreBreakdown && (
                <p className="text-xs text-gray-500 mt-3">Add trades or journal entries to calculate your metrics</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5 flex-1 flex flex-col"
              style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
              }}
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Recent Activity
              </h3>
              <div className="space-y-3 flex-1">
                {!statsLoading && recentActivity.length === 0 && (
                  <p className="text-xs text-gray-500">No activity yet — log a trade or journal entry to get started</p>
                )}
                {recentActivity.map((activity, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                      <activity.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0A0A0A] border border-blue-400/40 rounded-2xl overflow-hidden"
              style={{
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.25), inset 0 0 50px rgba(59, 130, 246, 0.05)',
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full bg-blue-400 animate-pulse`} />
                  <span className="text-sm font-medium text-gray-300">
                    {isVoiceMode ? 'Voice Conversation Mode' : 'Active Conversation'}
                  </span>
                  {isVoiceMode && (
                    <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded-lg">
                      Continuous
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isSupported && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSpeakerToggle}
                      className={`p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/5 ${autoSpeak ? 'text-blue-400 border-blue-400/30' : 'text-gray-400'}`}
                      title={autoSpeak ? 'Disable voice responses' : 'Enable voice responses'}
                    >
                      {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClearHistory}
                    className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-white/5"
                    title="Clear history"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </motion.button>
                </div>
              </div>

              <div className="h-[400px] sm:h-[500px] lg:h-[600px] overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative">
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[90%] md:max-w-[85%]">
                        {message.role === 'assistant' && (
                          <div
                            className="w-8 h-8 rounded-xl bg-blue-400/20 flex items-center justify-center flex-shrink-0 border border-blue-400/40"
                            style={{
                              boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)',
                            }}
                          >
                            <Sparkles className="w-4 h-4 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,1)]" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div
                            className={`
                              rounded-2xl px-4 py-3
                              ${message.role === 'user'
                                ? 'bg-blue-400/15 border border-blue-400/40 text-white'
                                : 'bg-[#111] border border-blue-400/30 text-white'
                              }
                            `}
                            style={{
                              boxShadow: message.role === 'user'
                                ? '0 0 20px rgba(59, 130, 246, 0.3)'
                                : '0 0 15px rgba(59, 130, 246, 0.2)',
                            }}
                          >
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.role === 'assistant' ? formatNovaMessage(message.content) : message.content}
                            </div>
                          </div>
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-1 px-1">
                              <button
                                onClick={() => submitFeedback(message.id, 'up')}
                                title="Good response"
                                className={`p-1.5 rounded-lg transition-colors border ${message.feedback === 'up' ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => submitFeedback(message.id, 'down')}
                                title="Bad response"
                                className={`p-1.5 rounded-lg transition-colors border ${message.feedback === 'down' ? 'text-red-400 bg-red-400/10 border-red-400/30' : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>


                {showSuggestions && messages.length <= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-center py-8"
                  >
                    <p className="text-sm text-gray-400 mb-4">Start a conversation or try a quick action below</p>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="p-6 border-t border-blue-400/20">
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isVoiceMode ? "Listening... Speak naturally to Nova" : "Ask NOVA anything about your trading..."}
                    disabled={isTyping || isVoiceMode}
                    style={{
                      boxShadow: '0 0 15px rgba(59, 130, 246, 0.2)',
                    }}
                    className="w-full bg-[#111] border border-blue-400/40 rounded-2xl pl-5 pr-28 py-4 text-sm focus:outline-none focus:border-blue-400/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onFocus={(e) => {
                      e.target.style.boxShadow = '0 0 25px rgba(59, 130, 246, 0.4)';
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.2)';
                    }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    {isSupported && (
                      <div className="relative">
                        {isListening && (
                          <>
                            <motion.div
                              className="absolute inset-0 rounded-xl bg-blue-400/30"
                              animate={{
                                opacity: [0.3, 0.6, 0.3],
                                scale: [1, 1.15, 1],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            />
                            <motion.div
                              className="absolute inset-0 rounded-xl"
                              animate={{
                                boxShadow: [
                                  '0 0 15px 3px rgba(96, 165, 250, 0.3)',
                                  '0 0 25px 6px rgba(96, 165, 250, 0.5)',
                                  '0 0 15px 3px rgba(96, 165, 250, 0.3)',
                                ],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            />
                          </>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          type="button"
                          onClick={handleMicClick}
                          className={`relative p-2.5 rounded-xl transition-colors ${
                            isVoiceMode
                              ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30'
                              : isListening
                                ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30'
                                : 'hover:bg-white/5 text-gray-400'
                          }`}
                          title={isVoiceMode ? 'Stop Conversation' : 'Start Conversation'}
                          disabled={isTyping}
                        >
                          <Mic className="w-5 h-5" />
                        </motion.button>
                      </div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="submit"
                      disabled={!input.trim() || isTyping || isVoiceMode}
                      className="p-2.5 bg-blue-400/20 hover:bg-blue-400/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/50"
                      style={{
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                      }}
                    >
                      <Send className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,1)]" />
                    </motion.button>
                  </div>
                </form>
                {isVoiceMode && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-blue-400 mt-2 text-center"
                  >
                    Conversation mode active - Speak naturally, NOVA will respond automatically
                  </motion.p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5"
              style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
              }}
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {quickActions.map((action, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubmit(action.query)}
                    disabled={isTyping}
                    className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center group-hover:bg-blue-400/20 transition-all border border-blue-400/30"
                      style={{
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <action.icon className="w-5 h-5 text-blue-400 group-hover:drop-shadow-[0_0_6px_rgba(59,130,246,1)]" />
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors text-left">{action.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5"
            style={{
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                NOVA Score Analysis
              </h3>
              <span className="text-3xl font-bold text-white">{scoreBreakdown ? scoreBreakdown.overall_score : '--'}</span>
            </div>

            {!scoreBreakdown ? (
              <p className="text-xs text-gray-500">Add trades or journal entries to see your score breakdown</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Overall Score</span>
                    <span className="text-xs text-white font-medium">{scoreBreakdown.overall_score}/100</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${scoreBreakdown.overall_score}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Score Breakdown</h4>

                  {[
                    { label: 'Profitability', icon: TrendingUp, value: scoreBreakdown.profitability_score, note: `${scoreBreakdown.win_rate.toFixed(0)}% win rate, ${scoreBreakdown.profit_factor.toFixed(2)} profit factor` },
                    { label: 'Risk Management', icon: Target, value: scoreBreakdown.risk_management_score, note: `Avg win/loss ratio ${scoreBreakdown.avg_win_loss_ratio.toFixed(2)}:1` },
                    { label: 'Consistency', icon: Activity, value: scoreBreakdown.consistency_score, note: `Based on ${scoreBreakdown.total_trades} trades` },
                    { label: 'Discipline', icon: Award, value: scoreBreakdown.discipline_score, note: 'Confluence use and overtrading check' },
                  ].map((row, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <row.icon className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-white">{row.label}</span>
                        </div>
                        <span className="text-sm font-medium text-blue-400">{row.value}/100</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${row.value}%` }} />
                      </div>
                      <p className="text-xs text-gray-400">{row.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5"
            style={{
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Your Trading Rules
              </h3>
              <button
                onClick={() => navigate('/checklists')}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit Rules
              </button>
            </div>

            {userTradingRules.length === 0 ? (
              <p className="text-xs text-gray-500">No trading rules set up yet - add some to keep yourself accountable</p>
            ) : (
              <div className="space-y-3">
                {userTradingRules.map((rule) => (
                  <div key={rule.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white mb-1">{rule.name}</h4>
                        {rule.description && (
                          <p className="text-xs text-gray-400 leading-relaxed mb-2">{rule.description}</p>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 bg-white/5'}`}>
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-[#0A0A0A] border border-blue-400/30 rounded-2xl p-5 mt-6"
          style={{
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 40px rgba(59, 130, 246, 0.05)',
          }}
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-400" />
            AI Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {loadingInsights ? (
              <div className="col-span-full flex items-center justify-center py-8">
                <div className="text-center">
                  <motion.div
                    className="w-8 h-8 mx-auto mb-2 rounded-lg bg-blue-400/20 flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </motion.div>
                  <p className="text-xs text-gray-400">Generating insights...</p>
                </div>
              </div>
            ) : insights.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-gray-400 mb-2">No insights available yet</p>
                <p className="text-xs text-gray-500">Log more trades to get personalized insights</p>
              </div>
            ) : (
              insights.slice(0, 3).map((insight, i) => {
                const IconComponent = getInsightIconComponent(insight.insight_type);
                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                    className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5 group relative"
                  >
                    <IconComponent className={`w-5 h-5 ${getInsightColor(insight.category)} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white mb-1">{insight.title}</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{insight.description}</p>
                    </div>
                    <button
                      onClick={() => handleDismissInsight(insight.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                      title="Dismiss insight"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {user && (
        <PersonalizationModal
          isOpen={showPersonalizationModal}
          onClose={() => setShowPersonalizationModal(false)}
          onComplete={handlePersonalizationComplete}
          userId={user.id}
        />
      )}

      <ConversationArchive
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewConversation={createNewSession}
        onDeleteSession={deleteSession}
      />

      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Chat History"
        message="This will permanently delete all chat messages. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={executeClearHistory}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
