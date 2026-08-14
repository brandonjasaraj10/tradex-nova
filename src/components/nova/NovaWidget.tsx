import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Brain, X, Trash2, Sparkles, Volume2, VolumeX, History, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNova } from '../../lib/novaContext';
import { useVoice } from '../../hooks/useVoice';
import { useDataSync } from '../../lib/dataSync';
import { correctTradingTerms } from '../../utils/tradingVocabulary';
import ConversationArchive from './ConversationArchive';
import ConfirmModal from '../shared/ConfirmModal';
import { formatNovaMessage } from '../../utils/formatNovaMessage';

export default function NovaWidget() {
  const { messages, isTyping, isLoading, isOpen, currentSessionId, setIsOpen, sendMessage, clearHistory, loadSession, createNewSession, deleteSession, submitFeedback } = useNova();
  const { refreshTrigger } = useDataSync();
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content !== lastMessageRef.current) {
        lastMessageRef.current = lastMessage.content;
        speak(lastMessage.content);
      }
    }
  }, [messages, autoSpeak, speak]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  const handleMicClick = () => {
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-black/95 backdrop-blur-lg border border-white/10 rounded-3xl shadow-2xl w-[380px] h-[600px] flex flex-col overflow-hidden"
          >
            <div className="p-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-400/20 flex items-center justify-center border border-blue-400/20">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Nova</h3>
                  <p className="text-xs text-gray-400">AI Trading Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isSupported && (
                  <button
                    onClick={handleSpeakerToggle}
                    className={`p-2 hover:bg-white/5 rounded-xl transition-colors ${autoSpeak ? 'text-blue-400' : 'text-gray-400'}`}
                    title={autoSpeak ? 'Disable voice responses' : 'Enable voice responses'}
                  >
                    {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => setShowArchive(true)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  title="View past conversations"
                >
                  <History className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={handleClearHistory}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-6 h-6 text-blue-400" />
                    </motion.div>
                    <p className="text-xs text-gray-400">Loading...</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="flex items-start gap-2 max-w-[85%]">
                        {message.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0 mt-1">
                            <Sparkles className="w-3 h-3 text-blue-400" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div
                            className={`
                            rounded-2xl px-4 py-3
                            ${message.role === 'user'
                                ? 'bg-blue-400/10 border border-blue-400/20 text-white'
                                : 'bg-white/5 text-white'
                              }
                          `}
                          >
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">
                              {message.role === 'assistant' ? formatNovaMessage(message.content) : message.content}
                            </div>
                          </div>
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-1 px-1">
                              <button
                                onClick={() => submitFeedback(message.id, 'up')}
                                title="Good response"
                                className={`p-1 rounded-lg transition-colors ${message.feedback === 'up' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => submitFeedback(message.id, 'down')}
                                title="Bad response"
                                className={`p-1 rounded-lg transition-colors ${message.feedback === 'down' ? 'text-red-400 bg-red-400/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Sparkles className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="bg-white/5 rounded-2xl px-4 py-3">
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="p-5 border-t border-white/10">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Nova..."
                  disabled={isTyping || isLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-20 py-3 text-sm focus:outline-none focus:border-blue-400/50 transition-colors placeholder:text-white/40 disabled:opacity-50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {isSupported && (
                    <button
                      type="button"
                      onClick={handleMicClick}
                      className={`p-2 hover:bg-white/5 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-400' : 'text-gray-400'}`}
                      title={isListening ? 'Stop recording' : 'Start recording'}
                      disabled={isTyping || isLoading}
                    >
                      <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping || isLoading}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setIsOpen(true)}
            className="bg-black/95 backdrop-blur-lg border border-white/10 p-4 rounded-2xl shadow-lg hover:border-blue-400/50 transition-all group"
          >
            <Sparkles className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

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
        onConfirm={async () => {
          setShowClearConfirm(false);
          await clearHistory();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
