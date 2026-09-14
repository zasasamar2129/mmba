import { useState, useEffect, useCallback, useRef } from 'react';
import { requestMicrophoneAccess } from './microphonePermission';

// SpeechRecognition type declarations for browsers
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type SpeechState = 'idle' | 'requesting_permission' | 'recording' | 'processing' | 'completed' | 'error';

export interface UseSpeechRecognitionOptions {
  language?: 'fa-IR' | 'en-US' | string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onError?: (errorMsg: string) => void;
}

export function useSpeechRecognition({
  language = 'fa-IR',
  continuous = false,
  onResult,
  onError,
}: UseSpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setState('processing');
      setTimeout(() => setState('idle'), 500);
    }
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const errText = 'مرورگر شما از ورودی صوت یا تبدیل گفتار به متن پشتیبانی نمی‌کند.';
      setErrorMessage(errText);
      setState('error');
      onError?.(errText);
      return;
    }

    setErrorMessage(null);
    setInterimTranscript('');
    setState('requesting_permission');

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState('recording');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(currentInterim);
        if (finalTrans) {
          setTranscript((prev) => {
            const updated = prev ? `${prev} ${finalTrans}` : finalTrans;
            onResult?.(updated);
            return updated;
          });
        }
      };

      recognition.onerror = (event: any) => {
        let errorText = `خطا در دریافت صدا: ${event.error}`;
        if (event.error === 'not-allowed') {
          errorText = 'دسترسی میکروفون در مرورگر داده نشد. لطفاً در بالای صفحه یا نوار آدرس گزینه Allow (مجاز بودن) را انتخاب کنید.';
        } else if (event.error === 'no-speech') {
          errorText = 'صدایی دریافت نشد. لطفاً نزدیک میکروفون صحبت کنید.';
        } else if (event.error === 'audio-capture') {
          errorText = 'میکروفون در دستگاه شناسایی نشد یا توسط برنامه دیگری اشغال شده است.';
        }
        setErrorMessage(errorText);
        setState('error');
        onError?.(errorText);
      };

      recognition.onend = () => {
        setState('idle');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      const errText = err.message || 'خطا در راه‌اندازی ضبط صدا';
      setErrorMessage(errText);
      setState('error');
      onError?.(errText);
    }
  }, [language, continuous, onResult, onError]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
    setState('idle');
  }, []);

  return {
    isSupported,
    state,
    isRecording: state === 'recording',
    isRequestingPermission: state === 'requesting_permission',
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
  };
}
