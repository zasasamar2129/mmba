import React from 'react';
import { Mic, MicOff, Loader2, ShieldAlert } from 'lucide-react';
import { useSpeechRecognition } from '../../lib/speechRecognition';
import { cn } from './Button';

export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language?: 'fa-IR' | 'en-US' | string;
  className?: string;
  size?: 'sm' | 'md';
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  language = 'fa-IR',
  className,
  size = 'sm',
}) => {
  const { isSupported, isRecording, isRequestingPermission, state, startListening, stopListening, errorMessage } =
    useSpeechRecognition({
      language,
      continuous: true,
      onResult: (text) => {
        onTranscript(text);
      },
    });

  if (!isSupported) {
    return (
      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1" title="مرورگر از گفتار به متن پشتیبانی نمی‌کند">
        <MicOff className="w-3.5 h-3.5" />
      </span>
    );
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isRequestingPermission}
        title={
          isRequestingPermission
            ? 'در انتظار تایید دسترسی به میکروفون در مرورگر (لطفاً روی Allow کلیک کنید)'
            : isRecording
            ? 'توقف ضبط صدا'
            : 'تبدیل صوت به متن با میکروفون'
        }
        className={cn(
          'relative inline-flex items-center justify-center rounded-lg transition-all duration-200 border select-none',
          size === 'sm' ? 'px-2 py-1 text-xs gap-1.5' : 'p-2',
          isRequestingPermission
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
            : isRecording
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/20 recording-pulse'
            : errorMessage
            ? 'bg-slate-800/80 text-rose-300 border-rose-500/40 hover:border-rose-400'
            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-indigo-400 hover:border-indigo-500/40',
          className
        )}
      >
        {isRequestingPermission ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span className="text-[11px] font-medium text-amber-300">درخواست مجوز...</span>
          </>
        ) : state === 'processing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        ) : isRecording ? (
          <>
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[11px] font-medium text-rose-300">در حال شنیدن...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">تایپ صوتی</span>
          </>
        )}
      </button>

      {errorMessage && (
        <span
          className="text-[10px] text-rose-400 max-w-[160px] truncate flex items-center gap-1 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50"
          title={errorMessage}
        >
          <ShieldAlert className="w-3 h-3 flex-shrink-0 text-rose-400" />
          <span className="truncate">{errorMessage}</span>
        </span>
      )}
    </div>
  );
};
