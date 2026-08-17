import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { NovaAIService, ChatMessage } from '../services/novaAI';

async function ensureSessionExists(sessionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existingSession } = await supabase
    .from('nova_conversation_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!existingSession) {
    await supabase
      .from('nova_conversation_sessions')
      .insert({
        id: sessionId,
        user_id: user.id,
        title: 'Journal Entry'
      });
  }
}

// A standalone Nova conversation scoped to a single session id, independent
// of the app-wide NovaProvider (Dashboard widget / NOVA AI page). Used for
// per-journal-entry chats so they don't share message history with the main
// assistant or with each other - see nova_session_id on journal_entries.
export function useNovaEntrySession(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const serviceRef = useRef<NovaAIService | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (!sessionId) {
      serviceRef.current = null;
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      await ensureSessionExists(sessionId);
      const service = new NovaAIService(sessionId);
      await service.initialize();
      if (cancelled) return;
      serviceRef.current = service;

      const history = await service.loadChatHistory();
      if (cancelled) return;

      if (history.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Hey! I'm Nova. Ask me to analyze your charts, help you fill out this entry, or just talk through your trade."
        };
        setMessages([welcomeMessage]);
        try {
          await service.saveMessage('assistant', welcomeMessage.content, welcomeMessage.id);
        } catch (error) {
          console.error('Error saving welcome message:', error);
        }
      } else {
        setMessages(history);
      }
      setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Returns the assistant's reply text on success, or undefined - callers
  // use this to know a message is a genuinely new reply (worth reacting
  // to, e.g. extracting journal data from it) rather than relying on the
  // messages array changing, which also happens on the initial history
  // load and would otherwise be indistinguishable from a live reply.
  const sendMessage = useCallback(async (content: string, images?: string[]): Promise<string | undefined> => {
    const service = serviceRef.current;
    if (!content.trim() || !service || isTyping) return undefined;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      await service.saveMessage('user', content.trim(), userMsg.id);

      const response = await service.generateResponse(content.trim(), messagesRef.current, images);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response
      };

      setMessages(prev => [...prev, assistantMsg]);
      await service.saveMessage('assistant', response, assistantMsg.id);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMsg]);
      return undefined;
    } finally {
      setIsTyping(false);
    }
  }, [isTyping]);

  return { messages, isTyping, isLoading, sendMessage };
}
