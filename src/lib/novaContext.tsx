import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase, getCurrentUser } from './supabase';
import { NovaAIService, ChatMessage } from '../services/novaAI';

interface NovaContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  isLoading: boolean;
  isOpen: boolean;
  currentSessionId: string;
  setIsOpen: (open: boolean) => void;
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  startVoiceSession: () => void;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'up' | 'down' | null) => Promise<void>;
}

const NovaContext = createContext<NovaContextType | undefined>(undefined);

const NOVA_SESSION_KEY = 'nova_session_id';

function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(NOVA_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(NOVA_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function NovaProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(getOrCreateSessionId());
  const [novaService, setNovaService] = useState(() => new NovaAIService(currentSessionId));
  const [isInitialized, setIsInitialized] = useState(false);

  const ensureSessionExists = useCallback(async (sessionId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      /*
        One idempotent write, not a read followed by a conditional write.

        The previous shape was the same check-then-insert race that produced
        duplicate welcome messages: two loads both find no session, both
        insert, and the second comes back 409 against the primary key. The
        error was swallowed so nothing appeared in the logs, but the request
        still went out on every page load - two of the 409s that made the
        console permanently red.

        ignoreDuplicates turns this into INSERT ... ON CONFLICT DO NOTHING,
        which cannot race with itself. It also drops the SELECT, so this is
        one round trip where it used to be two.
      */
      const { error } = await supabase
        .from('nova_conversation_sessions')
        .upsert(
          { id: sessionId, user_id: user.id, title: 'New Conversation' },
          { onConflict: 'id', ignoreDuplicates: true },
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error ensuring session exists:', error);
    }
  }, []);

  /*
    One load per session at a time.

    Two concurrent loads both read an empty history and both try to write the
    welcome message. A unique index has stopped that becoming two visible
    greetings since August, but the losing insert still made a round trip and
    came back 409, on every page load. Sharing the in-flight promise means the
    second caller waits for the first rather than racing it.

    Kept alongside the index rather than replacing it. This stops the common
    case - one tab, two effects - while the index is what holds when the races
    are further apart than a shared promise can reach, like two open tabs.
  */
  const inFlightLoads = useRef(new Map<string, Promise<void>>());

  const loadMessages = useCallback(async (sessionId?: string) => {
    const key = sessionId || currentSessionId || 'current';
    const running = inFlightLoads.current.get(key);
    if (running) return running;

    const load = (async () => {
    try {
      const targetSessionId = sessionId || currentSessionId;
      await ensureSessionExists(targetSessionId);

      const history = await novaService.loadChatHistory();
      if (history.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Hey! I'm NOVA, your AI Trading Assistant. I'm here to help you analyze your trades, review your performance, and provide insights. What would you like to explore?"
        };
        setMessages([welcomeMessage]);
        try {
          await novaService.saveMessage('assistant', welcomeMessage.content, welcomeMessage.id);
        } catch (saveError: any) {
          if (saveError?.code === '23505') {
            // A concurrent load already saved the welcome message for this
            // session - sync local state to whichever one actually won.
            setMessages(await novaService.loadChatHistory());
          } else {
            throw saveError;
          }
        }
      } else {
        setMessages(history);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
    })();

    inFlightLoads.current.set(key, load);
    try {
      await load;
    } finally {
      inFlightLoads.current.delete(key);
    }
  }, [novaService, currentSessionId, ensureSessionExists]);

  useEffect(() => {
    const initialize = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setIsLoading(false);
        setIsInitialized(false);
        return;
      }
      setIsLoading(true);
      await novaService.initialize();
      await loadMessages();
      setIsLoading(false);
      setIsInitialized(true);
    };
    initialize();
  }, [novaService, loadMessages]);

  useEffect(() => {
    if (!isInitialized) return;

    const channel = supabase
      .channel('nova_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nova_chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;
          const user = await getCurrentUser();

          if (newMessage.user_id === user?.id && newMessage.session_id === getOrCreateSessionId()) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id);
              if (exists) return prev;
              return [...prev, {
                id: newMessage.id,
                role: newMessage.role,
                content: newMessage.content,
                created_at: newMessage.created_at
              }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isInitialized]);

  const sendMessage = useCallback(async (content: string, images?: string[]) => {
    if (!content.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      await novaService.saveMessage('user', content.trim(), userMsg.id);

      /*
        Name the conversation after the first thing the user said.

        nova_conversation_sessions.title exists and defaults to "New
        Conversation", and nothing ever wrote anything else - so every row
        in the History drawer read "New Conversation", nine identical
        entries with no way to tell them apart. The search box above them
        searched titles, so it could not help either. A history you cannot
        navigate is not history.

        Only the first user message sets it, so the title stays put as the
        conversation goes on.
      */
      const isFirstUserMessage = !messages.some(m => m.role === 'user');
      if (isFirstUserMessage) {
        const trimmed = content.trim();
        const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
        await novaService.setSessionTitle(title);
      }

      const response = await novaService.generateResponse(content.trim(), messages, images);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response
      };

      setMessages(prev => [...prev, assistantMsg]);
      await novaService.saveMessage('assistant', response, assistantMsg.id);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [novaService, messages, isTyping]);

  const clearHistory = useCallback(async () => {
    try {
      await novaService.clearHistory();
      const newSessionId = crypto.randomUUID();
      localStorage.setItem(NOVA_SESSION_KEY, newSessionId);

      const welcomeMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hey! I'm NOVA, your AI Trading Assistant. I'm here to help you analyze your trades, review your performance, and provide insights. What would you like to explore?"
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, [novaService]);

  const refreshMessages = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  const startVoiceSession = useCallback(() => {
    const welcomeMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "Hey! I'm ready to chat. What would you like to know?"
    };
    setMessages([welcomeMessage]);
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      setCurrentSessionId(sessionId);
      localStorage.setItem(NOVA_SESSION_KEY, sessionId);

      const newService = new NovaAIService(sessionId);
      await newService.initialize();
      setNovaService(newService);

      await loadMessages(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadMessages]);

  const createNewSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const newSessionId = crypto.randomUUID();
      const user = await getCurrentUser();
      if (!user) return;

      await supabase
        .from('nova_conversation_sessions')
        .insert({
          id: newSessionId,
          user_id: user.id,
          title: 'New Conversation'
        });

      setCurrentSessionId(newSessionId);
      localStorage.setItem(NOVA_SESSION_KEY, newSessionId);

      const newService = new NovaAIService(newSessionId);
      await newService.initialize();
      setNovaService(newService);

      const welcomeMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hey! I'm NOVA, your AI Trading Assistant. I'm here to help you analyze your trades, review your performance, and provide insights. What would you like to explore?"
      };
      setMessages([welcomeMessage]);
      try {
        await newService.saveMessage('assistant', welcomeMessage.content, welcomeMessage.id);
      } catch (saveError: any) {
        if (saveError?.code !== '23505') throw saveError;
      }
    } catch (error) {
      console.error('Error creating new session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      await createNewSession();
    }
  }, [currentSessionId, createNewSession]);

  const submitFeedback = useCallback(async (messageId: string, rating: 'up' | 'down' | null) => {
    const previous = messages.find(m => m.id === messageId)?.feedback ?? null;
    const nextRating = previous === rating ? null : rating;

    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, feedback: nextRating } : m)));

    try {
      await novaService.submitFeedback(messageId, nextRating);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, feedback: previous } : m)));
    }
  }, [messages, novaService]);

  return (
    <NovaContext.Provider
      value={{
        messages,
        isTyping,
        isLoading,
        isOpen,
        currentSessionId,
        setIsOpen,
        sendMessage,
        clearHistory,
        refreshMessages,
        startVoiceSession,
        loadSession,
        createNewSession,
        deleteSession,
        submitFeedback
      }}
    >
      {children}
    </NovaContext.Provider>
  );
}

export function useNova() {
  const context = useContext(NovaContext);
  if (context === undefined) {
    throw new Error('useNova must be used within a NovaProvider');
  }
  return context;
}
