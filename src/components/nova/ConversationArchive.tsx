import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare, Trash2, Calendar, X, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../shared/Button';
import ConfirmModal from '../shared/ConfirmModal';

interface ConversationSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ConversationArchiveProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function ConversationArchive({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewConversation,
  onDeleteSession
}: ConversationArchiveProps) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sessionId: string }>({ isOpen: false, sessionId: '' });

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('nova_conversation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, sessionId });
  };

  const executeDeleteSession = async (sessionId: string) => {
    setDeleteConfirm({ isOpen: false, sessionId: '' });
    try {
      const { error: messagesError } = await supabase
        .from('nova_chat_messages')
        .delete()
        .eq('session_id', sessionId);

      if (messagesError) throw messagesError;

      const { error: sessionError } = await supabase
        .from('nova_conversation_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      setSessions(sessions.filter(s => s.id !== sessionId));
      onDeleteSession(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-black/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col"
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  Conversation History
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400/50"
                />
              </div>

              <Button
                onClick={onNewConversation}
                variant="primary"
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <motion.button
                      key={session.id}
                      onClick={() => {
                        onSelectSession(session.id);
                        onClose();
                      }}
                      className={`w-full p-4 rounded-lg border transition-all text-left group ${
                        currentSessionId === session.id
                          ? 'bg-blue-400/10 border-blue-400/30'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-white font-medium line-clamp-1 flex-1">
                          {session.title}
                        </h3>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {session.message_count} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(session.updated_at)}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <ConfirmModal
      isOpen={deleteConfirm.isOpen}
      title="Delete Conversation"
      message="This will permanently delete this conversation. This action cannot be undone."
      confirmLabel="Delete"
      variant="danger"
      onConfirm={() => executeDeleteSession(deleteConfirm.sessionId)}
      onCancel={() => setDeleteConfirm({ isOpen: false, sessionId: '' })}
    />
    </>
  );
}
