import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toastContext';

interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  autoSpeak?: boolean;
}

export function useVoice({ onTranscript, autoSpeak = false }: UseVoiceOptions = {}) {
  const { showToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isConversationMode, setIsConversationMode] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const conversationModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const hasProcessedTranscriptRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current || hasProcessedTranscriptRef.current) {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (speechDebounceTimerRef.current) {
          clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = null;
        }

        if (finalTranscript) {
          currentTranscriptRef.current += ' ' + finalTranscript;
        }

        const fullTranscript = (currentTranscriptRef.current + ' ' + interimTranscript).trim();

        if (fullTranscript && !isSpeakingRef.current) {
          speechDebounceTimerRef.current = setTimeout(() => {
            const completedTranscript = currentTranscriptRef.current.trim();
            if (completedTranscript && !hasProcessedTranscriptRef.current && !isSpeakingRef.current) {
              hasProcessedTranscriptRef.current = true;
              setTranscript(completedTranscript);
              if (onTranscriptRef.current) {
                onTranscriptRef.current(completedTranscript);
              }
              currentTranscriptRef.current = '';

              // Auto-stop listening if not in conversation mode
              if (!conversationModeRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch (error) {
                  console.error('Error auto-stopping recognition:', error);
                }
              }
            }
          }, 1500);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (conversationModeRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (conversationModeRef.current && !isSpeakingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('Error restarting recognition in conversation mode:', error);
              }
            }
          }, 100);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          showToast('Microphone access was blocked. Allow it in your browser settings to use voice input.', 'error');
        } else if (event.error === 'no-speech') {
          console.log('No speech detected');
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error('Error aborting recognition:', e);
        }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (speechDebounceTimerRef.current) {
        clearTimeout(speechDebounceTimerRef.current);
        speechDebounceTimerRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSpeaking(false);
      setTranscript('');
      currentTranscriptRef.current = '';
      hasProcessedTranscriptRef.current = false;
      if (speechDebounceTimerRef.current) {
        clearTimeout(speechDebounceTimerRef.current);
        speechDebounceTimerRef.current = null;
      }
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      if (error instanceof Error && error.message.includes('already started')) {
        console.log('Recognition already started, stopping and restarting...');
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 50);
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
      setIsListening(false);
    }
  }, [isListening]);

  const speak = useCallback(async (text: string) => {
    if (!text) return;

    isSpeakingRef.current = true;

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition before speaking:', e);
      }
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      setIsSpeaking(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nova-tts`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;

        cooldownTimerRef.current = setTimeout(() => {
          isSpeakingRef.current = false;
          hasProcessedTranscriptRef.current = false;
          currentTranscriptRef.current = '';
          cooldownTimerRef.current = null;

          if (conversationModeRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error restarting recognition after speaking:', error);
            }
          }
        }, 300);
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;

        cooldownTimerRef.current = setTimeout(() => {
          isSpeakingRef.current = false;
          hasProcessedTranscriptRef.current = false;
          currentTranscriptRef.current = '';
          cooldownTimerRef.current = null;

          if (conversationModeRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error restarting recognition after error:', error);
            }
          }
        }, 300);
      };

      await audio.play();
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);

      cooldownTimerRef.current = setTimeout(() => {
        isSpeakingRef.current = false;
        hasProcessedTranscriptRef.current = false;
        currentTranscriptRef.current = '';
        cooldownTimerRef.current = null;

        if (conversationModeRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error('Error restarting recognition after error:', error);
          }
        }
      }, 300);
    }
  }, [isListening]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }
    isSpeakingRef.current = false;
    hasProcessedTranscriptRef.current = false;
    currentTranscriptRef.current = '';
    setIsSpeaking(false);
  }, []);

  const startConversation = useCallback(() => {
    if (!recognitionRef.current || isConversationMode) return;

    conversationModeRef.current = true;
    setIsConversationMode(true);

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSpeaking(false);
      setTranscript('');
      currentTranscriptRef.current = '';
      hasProcessedTranscriptRef.current = false;
      if (speechDebounceTimerRef.current) {
        clearTimeout(speechDebounceTimerRef.current);
        speechDebounceTimerRef.current = null;
      }
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting conversation:', error);
      conversationModeRef.current = false;
      setIsConversationMode(false);
    }
  }, [isConversationMode]);

  const stopConversation = useCallback(() => {
    conversationModeRef.current = false;
    setIsConversationMode(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping conversation:', error);
      }
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }

    isSpeakingRef.current = false;
    hasProcessedTranscriptRef.current = false;
    currentTranscriptRef.current = '';
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (autoSpeak && transcript && onTranscript) {
      speak(transcript);
    }
  }, [transcript, autoSpeak, speak, onTranscript]);

  return {
    isListening,
    isSpeaking,
    isSupported,
    transcript,
    isConversationMode,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    startConversation,
    stopConversation,
  };
}
