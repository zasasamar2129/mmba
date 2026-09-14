import { useState, useRef, useEffect, useCallback } from 'react';
import {
  isMicrophoneSupported,
  isAudioSecureContext,
  executeGetUserMedia,
  parseMicrophoneError,
  MicErrorInfo,
} from './microphonePermission';

export type RecorderStatus =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'recorded'
  | 'permission_denied'
  | 'unavailable'
  | 'unsupported'
  | 'error';

export interface UseAudioRecorderReturn {
  status: RecorderStatus;
  isRecording: boolean;
  isPaused: boolean;
  isRequestingPermission: boolean;
  isProcessing: boolean;
  hasRecordedAudio: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioDataUrl: string | null;
  audioLevels: number[];
  error: string | null;
  errorInfo: MicErrorInfo | null;
  startRecording: () => Promise<boolean>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<{ blob: Blob; url: string; dataUrl: string; duration: number } | null>;
  cancelRecording: () => void;
  resetAudio: () => void;
  retryPermission: () => Promise<boolean>;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes raw audio float buffers into standard 16-bit PCM WAV Blob
 * Fallback for Safari/browsers where MediaRecorder might be unavailable or glitchy.
 */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 - Mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(5));
  const [errorInfo, setErrorInfo] = useState<MicErrorInfo | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isRequestingRef = useRef<boolean>(false);

  // Fallback WAV processor refs for iOS / unsupported MediaRecorder
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const wavBuffersRef = useRef<Float32Array[]>([]);
  const isWavFallbackRef = useRef<boolean>(false);

  // Safely stop all active audio tracks and release hardware
  const releaseMediaTracks = useCallback(() => {
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch {}
      audioStreamRef.current = null;
    }
  }, []);

  // Safely cleanup audio context and nodes
  const releaseAudioContext = useCallback(() => {
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Clean up streams & audio context on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      releaseMediaTracks();
      releaseAudioContext();
    };
  }, [releaseMediaTracks, releaseAudioContext]);

  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current || status !== 'recording') {
      return;
    }

    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const barCount = 16;
      const step = Math.floor(dataArray.length / barCount);
      const levels: number[] = [];

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j] || 0;
        }
        const avg = sum / (step || 1);
        const normalized = Math.max(8, Math.min(100, Math.round((avg / 255) * 100)));
        levels.push(normalized);
      }

      setAudioLevels(levels);
      animFrameRef.current = requestAnimationFrame(updateAudioLevels);
    } catch {
      // ignore
    }
  }, [status]);

  /**
   * Main entry point to request mic and start recording.
   * Runs directly synchronously within user click event context.
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    // Prevent overlapping clicks
    if (isRequestingRef.current || status === 'recording') {
      return false;
    }

    // Reset previous audio artifacts
    setErrorInfo(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioDataUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    wavBuffersRef.current = [];
    isWavFallbackRef.current = false;

    // Check secure context and support
    if (!isAudioSecureContext()) {
      const err = parseMicrophoneError(new Error('INSECURE_CONTEXT'));
      setErrorInfo(err);
      setStatus('permission_denied');
      return false;
    }

    if (!isMicrophoneSupported()) {
      const err = parseMicrophoneError(new Error('UNSUPPORTED_MEDIA_DEVICES'));
      setErrorInfo(err);
      setStatus('unsupported');
      return false;
    }

    // Clean up any stale streams before starting a new one
    releaseMediaTracks();
    releaseAudioContext();

    isRequestingRef.current = true;
    setStatus('requesting_permission');

    try {
      // Request microphone access directly with standard constraints
      // to guarantee native browser permission popup on Chrome/Safari/Firefox/Edge/Android
      const stream = await executeGetUserMedia({ audio: true });

      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error('NOT_FOUND');
      }

      audioStreamRef.current = stream;
      isRequestingRef.current = false;

      // Initialize Web Audio Context for visualizer and iOS compatibility
      let audioCtx: AudioContext | null = null;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
        }
      } catch (ctxErr) {
        console.warn('Audio visualizer init warning:', ctxErr);
      }

      // Initialize MediaRecorder
      let recorderCreated = false;
      if (typeof MediaRecorder !== 'undefined') {
        const candidateTypes = [
          'audio/mp4;codecs=mp4a.40.2',
          'audio/mp4',
          'audio/aac',
          'audio/wav',
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
        ];

        let selectedMimeType = '';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
          for (const type of candidateTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              selectedMimeType = type;
              break;
            }
          }
        }

        try {
          const recorder = selectedMimeType
            ? new MediaRecorder(stream, { mimeType: selectedMimeType })
            : new MediaRecorder(stream);

          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.start(100);
          recorderCreated = true;
        } catch (recInitErr) {
          console.warn('MediaRecorder with mimeType failed, falling back to default constructor:', recInitErr);
          try {
            const basicRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = basicRecorder;
            basicRecorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                audioChunksRef.current.push(event.data);
              }
            };
            basicRecorder.start(100);
            recorderCreated = true;
          } catch (basicErr) {
            console.warn('MediaRecorder standard instantiation failed, falling back to Web Audio WAV:', basicErr);
          }
        }
      }

      // Fallback: If MediaRecorder is unavailable on older iOS WebKit, use ScriptProcessor WAV recorder
      if (!recorderCreated && audioCtx) {
        isWavFallbackRef.current = true;
        const source = audioCtx.createMediaStreamSource(stream);
        const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          wavBuffersRef.current.push(new Float32Array(inputData));
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(audioCtx.destination);
        scriptProcessorRef.current = scriptProcessor;
        recorderCreated = true;
      }

      if (!recorderCreated) {
        const err = parseMicrophoneError(new Error('UNSUPPORTED_MEDIA_DEVICES'));
        setErrorInfo(err);
        setStatus('unsupported');
        releaseMediaTracks();
        releaseAudioContext();
        return false;
      }

      setStatus('recording');
      startTimeRef.current = Date.now();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      if (analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateAudioLevels);
      }

      return true;
    } catch (err: any) {
      isRequestingRef.current = false;
      const parsed = parseMicrophoneError(err);
      setErrorInfo(parsed);

      if (parsed.type === 'NOT_ALLOWED' || parsed.type === 'INSECURE_CONTEXT' || parsed.type === 'SECURITY_ERROR') {
        setStatus('permission_denied');
      } else if (parsed.type === 'NOT_FOUND' || parsed.type === 'NOT_READABLE') {
        setStatus('unavailable');
      } else if (parsed.type === 'UNSUPPORTED') {
        setStatus('unsupported');
      } else {
        setStatus('error');
      }

      releaseMediaTracks();
      releaseAudioContext();
      return false;
    }
  }, [status, updateAudioLevels, releaseMediaTracks, releaseAudioContext]);

  const pauseRecording = useCallback(() => {
    if (status !== 'recording') return;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
      } catch {}
    }

    setStatus('paused');
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [status]);

  const resumeRecording = useCallback(() => {
    if (status !== 'paused') return;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
      } catch {}
    }

    setStatus('recording');
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);

    if (analyserRef.current) {
      animFrameRef.current = requestAnimationFrame(updateAudioLevels);
    }
  }, [status, updateAudioLevels]);

  const stopRecording = useCallback((): Promise<{ blob: Blob; url: string; dataUrl: string; duration: number } | null> => {
    return new Promise(async (resolve) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      setStatus('processing');
      const currentDuration = recordingDuration || 1;

      // Handle WAV Fallback (Safari / iOS)
      if (isWavFallbackRef.current) {
        try {
          if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
          }

          const sampleRate = audioContextRef.current?.sampleRate || 44100;
          let totalLength = 0;
          for (const buf of wavBuffersRef.current) {
            totalLength += buf.length;
          }

          const mergedSamples = new Float32Array(totalLength);
          let offset = 0;
          for (const buf of wavBuffersRef.current) {
            mergedSamples.set(buf, offset);
            offset += buf.length;
          }

          const finalBlob = encodeWAV(mergedSamples, sampleRate);
          const url = URL.createObjectURL(finalBlob);
          const dataUrl = await blobToDataUrl(finalBlob);

          setAudioBlob(finalBlob);
          setAudioUrl(url);
          setAudioDataUrl(dataUrl);
          setStatus('recorded');

          releaseMediaTracks();
          releaseAudioContext();

          resolve({
            blob: finalBlob,
            url,
            dataUrl,
            duration: currentDuration,
          });
          return;
        } catch (wavErr) {
          console.error('WAV encoding failed:', wavErr);
          const err = parseMicrophoneError(wavErr);
          setErrorInfo(err);
          setStatus('error');
          releaseMediaTracks();
          releaseAudioContext();
          resolve(null);
          return;
        }
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setStatus('idle');
        releaseMediaTracks();
        releaseAudioContext();
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(finalBlob);
          const dataUrl = await blobToDataUrl(finalBlob);

          setAudioBlob(finalBlob);
          setAudioUrl(url);
          setAudioDataUrl(dataUrl);
          setStatus('recorded');

          releaseMediaTracks();
          releaseAudioContext();

          resolve({
            blob: finalBlob,
            url,
            dataUrl,
            duration: currentDuration,
          });
        } catch (e: any) {
          const err = parseMicrophoneError(e);
          setErrorInfo(err);
          setStatus('error');
          releaseMediaTracks();
          releaseAudioContext();
          resolve(null);
        }
      };

      try {
        recorder.stop();
      } catch {
        setStatus('idle');
        releaseMediaTracks();
        releaseAudioContext();
        resolve(null);
      }
    });
  }, [recordingDuration, releaseMediaTracks, releaseAudioContext]);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    releaseMediaTracks();
    releaseAudioContext();

    setStatus('idle');
    setRecordingDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioDataUrl(null);
    setAudioLevels(new Array(16).fill(5));
    setErrorInfo(null);
    audioChunksRef.current = [];
    wavBuffersRef.current = [];
    isRequestingRef.current = false;
  }, [releaseMediaTracks, releaseAudioContext]);

  const resetAudio = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  const retryPermission = useCallback(async (): Promise<boolean> => {
    return await startRecording();
  }, [startRecording]);

  return {
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    isRequestingPermission: status === 'requesting_permission',
    isProcessing: status === 'processing',
    hasRecordedAudio: Boolean(audioDataUrl || audioBlob),
    recordingDuration,
    audioBlob,
    audioUrl,
    audioDataUrl,
    audioLevels,
    error: errorInfo ? errorInfo.message : null,
    errorInfo,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    resetAudio,
    retryPermission,
  };
}
