import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/*
  Record a short voice note and get text back, for browsers that have no
  built-in speech recognition - Instagram's in-app browser above all, which
  is where most new visitors arrive. The audio goes to the transcribe-audio
  edge function. See there for why.

  Needs a secure (https) page and a browser with MediaRecorder; isSupported
  says whether both are present, so the mic is only drawn where it can work.
  Stops itself after two minutes.
*/

const MAX_MS = 120_000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  /* Chrome and Android record webm; Safari and iOS web views record mp4. */
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

export function useRecorder(onText: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Elapsed seconds while recording, so the screen visibly moves. */
  const [seconds, setSeconds] = useState(0);
  const tickRef = useRef<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        window.isSecureContext &&
        typeof MediaRecorder !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const transcribe = useCallback(async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, mimeType.includes('mp4') ? 'entry.mp4' : 'entry.webm');
      const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', { body: form });
      if (fnError) throw fnError;
      const text = (data as { text?: string; error?: string })?.text;
      if (text) onTextRef.current(text);
      else setError((data as { error?: string })?.error ?? 'Could not make that out - try again, or type it.');
    } catch (err) {
      console.error('Transcription failed:', err);
      setError('Could not make that out - try again, or type it.');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (tickRef.current) window.clearInterval(tickRef.current);
        setIsRecording(false);
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) void transcribe(blob, type);
      };
      recorderRef.current = recorder;
      /* A timeslice, so data arrives in pieces and a long clip never sits in one huge buffer. */
      recorder.start(1000);
      setIsRecording(true);
      setSeconds(0);
      tickRef.current = window.setInterval(() => setSeconds((n) => n + 1), 1000);
      timerRef.current = window.setTimeout(stop, MAX_MS);
    } catch (err) {
      console.error('Microphone unavailable:', err);
      setError('The microphone is blocked here - type it instead.');
      setIsRecording(false);
    }
  }, [stop, transcribe]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  return { isSupported, isRecording, isTranscribing, error, seconds, start, stop };
}
