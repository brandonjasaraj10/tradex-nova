import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Mic, MicOff, Wand2, Image, FileText, Brain, Check, X, Volume2, VolumeX } from 'lucide-react';
import { useNovaEntrySession } from '../../hooks/useNovaEntrySession';
import { useVoice } from '../../hooks/useVoice';
import { correctTradingTerms } from '../../utils/tradingVocabulary';
import { formatNovaMessage } from '../../utils/formatNovaMessage';

interface Screenshot {
  url: string;
  label: string;
}

interface JournalData {
  title?: string;
  mood?: string;
  content?: string;
  symbol?: string;
  trade_duration?: string;
  tags?: string[];
  pre_market_notes?: string;
  post_market_notes?: string;
}

interface PsychologyData {
  pre_trade_mindset?: {
    mood_rating?: number;
    external_factors?: string;
    intention?: string;
  };
  emotional_checkin?: {
    emotions?: string[];
    notes?: string;
  };
  post_trade_reflection?: {
    strongest_emotion?: string;
    emotion_handling?: string;
    lessons_learned?: string;
    improvements?: string;
  };
  affirmations?: string[];
  psychological_wins?: string[];
  stress_levels?: {
    morning?: number;
    midday?: number;
    evening?: number;
  };
  decision_quality_score?: number;
  end_of_day_summary?: {
    psychological_state?: 'excellent' | 'moderate' | 'challenging';
    key_wins?: string;
    key_challenges?: string;
    mental_state_reflection?: string;
  };
}

interface NovaJournalAssistantProps {
  onExtractContent: (content: JournalData) => void;
  onExtractPsychology?: (data: PsychologyData) => void;
  currentDate: string;
  beforeScreenshots?: Screenshot[];
  afterScreenshots?: Screenshot[];
  isPsychologyMode?: boolean;
  onClose?: () => void;
  sessionId: string | null;
  onSessionCreated?: (id: string) => void;
}

const QUICK_PROMPTS = [
  { label: 'Fill Journal', icon: FileText, prompt: 'Help me fill out my trading journal for today. Ask me about my trades.' },
  { label: 'Analyze Charts', icon: Image, prompt: 'Look at my chart screenshots and help me document this trade setup.' },
  { label: 'Psychology Check', icon: Brain, prompt: 'Let\'s do a psychological check-in. How am I feeling about my trading today?' },
  { label: 'Auto-Fill All', icon: Wand2, prompt: 'Walk me through filling out my entire journal entry - trades, notes, and psychology.' },
];

export default function NovaJournalAssistant({
  onExtractContent,
  onExtractPsychology,
  currentDate,
  beforeScreenshots = [],
  afterScreenshots = [],
  isPsychologyMode = false,
  onClose,
  sessionId,
  onSessionCreated
}: NovaJournalAssistantProps) {
  const { messages, isTyping, isLoading, sendMessage } = useNovaEntrySession(sessionId, onSessionCreated);
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [pendingExtraction, setPendingExtraction] = useState<{journal?: JournalData; psychology?: PsychologyData} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string>('');

  const { isListening, isSpeaking, isSupported, startListening, stopListening, speak, stopSpeaking } = useVoice({
    onTranscript: (text) => {
      // Apply trading term corrections before setting input
      const correctedText = correctTradingTerms(text);
      setInput(correctedText);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content !== lastMessageRef.current) {
        lastMessageRef.current = lastMessage.content;
        speak(lastMessage.content);
      }
    }
  }, [messages, autoSpeak, speak]);

  const toggleListening = () => {
    if (!isSupported) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSpeakerToggle = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setAutoSpeak(!autoSpeak);
  };

  const extractJournalData = (text: string): JournalData => {
    const extracted: JournalData = {};
    const lowerText = text.toLowerCase();

    const moodPatterns = [
      /(?:feeling|mood|feel)\s+(?:is\s+)?(\w+)/i,
      /(?:i'm|i am)\s+(?:feeling\s+)?(\w+)/i,
    ];
    for (const pattern of moodPatterns) {
      const match = text.match(pattern);
      if (match) {
        extracted.mood = match[1];
        break;
      }
    }

    const symbolPatterns = [
      /symbol[:\s-]+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
      /pair[:\s-]+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
      /currency pair[:\s-]+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
      /instrument[:\s-]+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
      /(?:traded|trading|on)\s+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
      /([A-Z]{2,10}(?:\/[A-Z]{2,10})?)\s+(?:trade|position|setup)/i,
      /\b([A-Z]{3}USD|USD[A-Z]{3}|EUR[A-Z]{3}|GBP[A-Z]{3}|[A-Z]{6})\b/,
      /\*\*Symbol\*\*[:\s-]+([A-Z]{2,10}(?:\/[A-Z]{2,10})?)/i,
    ];
    for (const pattern of symbolPatterns) {
      const match = text.match(pattern);
      if (match) {
        extracted.symbol = match[1].toUpperCase().replace(/\s/g, '');
        break;
      }
    }

    const durationMatch = text.match(/(?:held|duration|for)\s+(?:about\s+)?(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?))/i);
    if (durationMatch) {
      extracted.trade_duration = durationMatch[1];
    }

    const tagMatches = text.match(/#(\w+)/g);
    if (tagMatches) {
      extracted.tags = tagMatches.map(tag => tag.substring(1));
    }

    if (lowerText.includes('pre-market') || lowerText.includes('premarket') || lowerText.includes('before market') || lowerText.includes('before the session')) {
      extracted.pre_market_notes = text;
    } else if (lowerText.includes('post-market') || lowerText.includes('postmarket') || lowerText.includes('after market') || lowerText.includes('end of day')) {
      extracted.post_market_notes = text;
    } else if (text.length > 50) {
      extracted.content = text;
    }

    return extracted;
  };

  const extractPsychologyData = (text: string): PsychologyData => {
    const extracted: PsychologyData = {};
    const lowerText = text.toLowerCase();

    const moodRatingMatch = text.match(/(?:mood|feeling).*?(\d+)(?:\s*\/\s*10|out of 10)?/i);
    if (moodRatingMatch) {
      const rating = parseInt(moodRatingMatch[1]);
      if (rating >= 1 && rating <= 10) {
        extracted.pre_trade_mindset = { ...extracted.pre_trade_mindset, mood_rating: rating };
      }
    }

    const emotions: string[] = [];
    const emotionKeywords = ['confident', 'anxious', 'excited', 'fearful', 'calm', 'frustrated', 'focused', 'distracted', 'overwhelmed', 'patient', 'impatient', 'greedy', 'disciplined', 'fomo', 'stressed', 'optimistic', 'peaceful'];
    for (const emotion of emotionKeywords) {
      if (lowerText.includes(emotion)) {
        emotions.push(emotion.charAt(0).toUpperCase() + emotion.slice(1));
      }
    }
    if (emotions.length > 0) {
      extracted.emotional_checkin = { emotions };
    }

    if (lowerText.includes('revenge trading')) {
      extracted.emotional_checkin = { ...extracted.emotional_checkin, emotions: [...(extracted.emotional_checkin?.emotions || []), 'Revenge Trading'] };
    }

    const emotionalNotesMatch = text.match(/(?:emotional notes?|how (?:i'm|i am) feeling)[\s:]+(.+?)(?:\.|$)/i);
    if (emotionalNotesMatch) {
      extracted.emotional_checkin = { ...extracted.emotional_checkin, notes: emotionalNotesMatch[1].trim() };
    }

    const stressMatch = text.match(/(?:morning|midday|evening)\s+stress.*?(\d+)/i);
    if (stressMatch) {
      const level = parseInt(stressMatch[1]);
      const timeMatch = text.match(/(morning|midday|evening)/i);
      if (level >= 1 && level <= 10 && timeMatch) {
        const time = timeMatch[1].toLowerCase() as 'morning' | 'midday' | 'evening';
        extracted.stress_levels = { [time]: level };
      }
    } else {
      const generalStressMatch = text.match(/stress(?:ed)?.*?(\d+)/i);
      if (generalStressMatch) {
        const level = parseInt(generalStressMatch[1]);
        if (level >= 1 && level <= 10) {
          extracted.stress_levels = { morning: level };
        }
      }
    }

    const decisionMatch = text.match(/decision.*?(\d+)/i);
    if (decisionMatch) {
      const score = parseInt(decisionMatch[1]);
      if (score >= 1 && score <= 10) {
        extracted.decision_quality_score = score;
      }
    }

    if (lowerText.includes('excellent') || lowerText.includes('great day') || lowerText.includes('amazing')) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, psychological_state: 'excellent' };
    } else if (lowerText.includes('challenging') || lowerText.includes('difficult') || lowerText.includes('struggled')) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, psychological_state: 'challenging' };
    } else if (lowerText.includes('moderate') || lowerText.includes('okay') || lowerText.includes('decent')) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, psychological_state: 'moderate' };
    }

    const intentionMatch = text.match(/(?:my intention|i intend to|goal is to|i will|today i will)\s+(.+?)(?:\.|$)/i);
    if (intentionMatch) {
      extracted.pre_trade_mindset = { ...extracted.pre_trade_mindset, intention: intentionMatch[1].trim() };
    }

    const externalFactorsMatch = text.match(/(?:external factors?|affecting me|outside influence)[\s:]+(.+?)(?:\.|$)/i);
    if (externalFactorsMatch) {
      extracted.pre_trade_mindset = { ...extracted.pre_trade_mindset, external_factors: externalFactorsMatch[1].trim() };
    }

    const winMatch = text.match(/(?:win|proud of|accomplished|success|victory)[\s:]+(.+?)(?:\.|$)/i);
    if (winMatch) {
      extracted.psychological_wins = [winMatch[1].trim()];
    }

    const lessonMatch = text.match(/(?:learned|lesson|takeaway|realized)[\s:]+(.+?)(?:\.|$)/i);
    if (lessonMatch) {
      extracted.post_trade_reflection = { ...extracted.post_trade_reflection, lessons_learned: lessonMatch[1].trim() };
    }

    const strongestEmotionMatch = text.match(/(?:strongest emotion|main emotion|biggest feeling)[\s:]+(.+?)(?:\.|$)/i);
    if (strongestEmotionMatch) {
      extracted.post_trade_reflection = { ...extracted.post_trade_reflection, strongest_emotion: strongestEmotionMatch[1].trim() };
    }

    const emotionHandlingMatch = text.match(/(?:handled it|managed|dealt with it|response was)[\s:]+(.+?)(?:\.|$)/i);
    if (emotionHandlingMatch) {
      extracted.post_trade_reflection = { ...extracted.post_trade_reflection, emotion_handling: emotionHandlingMatch[1].trim() };
    }

    const improvementMatch = text.match(/(?:could improve|next time|better approach|work on)[\s:]+(.+?)(?:\.|$)/i);
    if (improvementMatch) {
      extracted.post_trade_reflection = { ...extracted.post_trade_reflection, improvements: improvementMatch[1].trim() };
    }

    const affirmationMatch = text.match(/(?:affirmation|affirm|positive thought)[\s:]+(.+?)(?:\.|$)/i);
    if (affirmationMatch) {
      extracted.affirmations = [affirmationMatch[1].trim()];
    }

    const keyWinsMatch = text.match(/(?:key wins?|psychological wins?)[\s:]+(.+?)(?:\.|$)/i);
    if (keyWinsMatch) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, key_wins: keyWinsMatch[1].trim() };
    }

    const keyChallengesMatch = text.match(/(?:key challenges?|struggles?)[\s:]+(.+?)(?:\.|$)/i);
    if (keyChallengesMatch) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, key_challenges: keyChallengesMatch[1].trim() };
    }

    const reflectionMatch = text.match(/(?:reflection|mental state|mindset today)[\s:]+(.+?)(?:\.|$)/i);
    if (reflectionMatch && reflectionMatch[1].length > 20) {
      extracted.end_of_day_summary = { ...extracted.end_of_day_summary, mental_state_reflection: reflectionMatch[1].trim() };
    }

    return extracted;
  };

  const buildContextMessage = (): string => {
    let context = `[Context: Date ${currentDate}] `;

    if (beforeScreenshots.length > 0 || afterScreenshots.length > 0) {
      context += `[User has ${beforeScreenshots.length} before and ${afterScreenshots.length} after chart screenshots] `;
    }

    if (isPsychologyMode) {
      context += '[Psychology Journal Mode - help with emotional reflection] ';
    }

    return context;
  };

  const handleSend = async (messageText?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isTyping || isLoading) return;

    setInput('');
    setShowQuickPrompts(false);

    const journalData = extractJournalData(userMessage);
    const psychologyData = extractPsychologyData(userMessage);

    if (Object.keys(journalData).length > 0 || Object.keys(psychologyData).length > 0) {
      setPendingExtraction({
        journal: Object.keys(journalData).length > 0 ? journalData : undefined,
        psychology: Object.keys(psychologyData).length > 0 ? psychologyData : undefined,
      });
    }

    const contextMessage = buildContextMessage();

    // Collect screenshot URLs to send to Nova for vision analysis
    const screenshotUrls: string[] = [];
    if (beforeScreenshots.length > 0) {
      screenshotUrls.push(...beforeScreenshots.map(s => s.url));
    }
    if (afterScreenshots.length > 0) {
      screenshotUrls.push(...afterScreenshots.map(s => s.url));
    }

    const reply = await sendMessage(contextMessage + userMessage, screenshotUrls.length > 0 ? screenshotUrls : undefined);

    if (reply) {
      const replyJournalData = extractJournalData(reply);
      const replyPsychologyData = extractPsychologyData(reply);

      if (Object.keys(replyJournalData).length > 0 || Object.keys(replyPsychologyData).length > 0) {
        setPendingExtraction({
          journal: Object.keys(replyJournalData).length > 0 ? replyJournalData : undefined,
          psychology: Object.keys(replyPsychologyData).length > 0 ? replyPsychologyData : undefined,
        });
      }
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const applyExtraction = () => {
    if (pendingExtraction?.journal) {
      onExtractContent(pendingExtraction.journal);
    }
    if (pendingExtraction?.psychology && onExtractPsychology) {
      onExtractPsychology(pendingExtraction.psychology);
    }
    setPendingExtraction(null);
  };

  const dismissExtraction = () => {
    setPendingExtraction(null);
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center border border-blue-400/20">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Nova Journal Assistant</h3>
            <p className="text-xs text-gray-400">
              {isPsychologyMode ? 'Psychology Mode' : 'Journal Mode'} - Synced
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSupported && (
            <button
              onClick={handleSpeakerToggle}
              className={`p-2 rounded-lg transition-colors ${autoSpeak ? 'bg-blue-400/20 text-blue-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              title={autoSpeak ? 'Disable voice responses' : 'Enable voice responses'}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          {(beforeScreenshots.length > 0 || afterScreenshots.length > 0) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-400/10 rounded-lg border border-blue-400/20">
              <Image className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-400">{beforeScreenshots.length + afterScreenshots.length} charts</span>
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Close Nova"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {pendingExtraction && (
        <div className="p-3 bg-green-500/10 border-b border-green-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">Nova detected journal data to auto-fill</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={applyExtraction}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-colors"
              >
                <Check className="w-3 h-3" />
                Apply
              </button>
              <button
                onClick={dismissExtraction}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs font-medium transition-colors"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-8 h-8 text-blue-400" />
              </motion.div>
              <p className="text-sm text-gray-400">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.length <= 1 && showQuickPrompts && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-3">Quick actions - speak naturally and I'll fill your journal:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((item, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/30 rounded-xl text-left transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center group-hover:bg-blue-400/20 transition-colors">
                        <item.icon className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-start gap-2 max-w-[90%]">
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0 mt-1 border border-blue-400/20">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-xl ${
                      message.role === 'user'
                        ? 'bg-blue-400/10 text-white border border-blue-400/20'
                        : 'bg-white/5 text-gray-200 border border-white/5'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.role === 'assistant' ? formatNovaMessage(message.content) : message.content}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0 mt-1 border border-blue-400/20">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-[#050505]">
        <div className="flex gap-2 items-center">
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
              isListening
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isListening ? 'Listening... speak now' : 'Tell Nova about your trading day...'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-12 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
              disabled={isTyping || isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={isTyping || isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        {isListening && (
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <p className="text-xs text-red-400">Listening... speak clearly</p>
          </div>
        )}
      </div>
    </div>
  );
}
