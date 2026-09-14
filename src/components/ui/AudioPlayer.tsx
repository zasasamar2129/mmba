import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from './Button';
import { isWebMAudio, isIosOrSafari, transcodeToCompatibleWav, WebAudioStreamPlayer } from '../../lib/audioTranscoder';
import { useTranslation } from '../../lib/i18n';

export interface AudioPlayerProps {
  src: string;
  duration?: number; // fallback duration in seconds if known
  title?: string;
  className?: string;
  compact?: boolean;
  showDownload?: boolean;
  onEnded?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration: fallbackDuration,
  title,
  className,
  compact = false,
  showDownload = true,
  onEnded,
}) => {
  const { language, isRtl } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const webAudioPlayerRef = useRef<WebAudioStreamPlayer | null>(null);

  const [activeSrc, setActiveSrc] = useState<string>(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'HTML5' | 'WEB_AUDIO'>('HTML5');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset audio state when source changes
  useEffect(() => {
    setActiveSrc(src);
    setCurrentTime(0);
    setIsPlaying(false);
    setHasError(false);
    setErrorMessage(null);
    setPlaybackMode('HTML5');

    if (webAudioPlayerRef.current) {
      webAudioPlayerRef.current.stop();
    }

    // Auto-detect if we are on iOS/Safari and the source is WebM
    // Transcode proactively to guarantee immediate seamless playback on iPhone 8
    if (isIosOrSafari() && isWebMAudio(src)) {
      setIsTranscoding(true);
      transcodeToCompatibleWav(src)
        .then((result) => {
          setActiveSrc(result.objectUrl || result.dataUrl);
          if (result.duration && (!duration || isNaN(duration))) {
            setDuration(result.duration);
          }
          setIsTranscoding(false);
        })
        .catch((err) => {
          console.warn('[AudioPlayer] Proactive transcoding failed, will attempt runtime fallback:', err);
          setIsTranscoding(false);
        });
    }
  }, [src]);

  // Handle HTML5 audio events
  useEffect(() => {
    if (playbackMode !== 'HTML5') return;
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleError = async (e: Event) => {
      console.warn('[AudioPlayer] HTML5 audio error encountered, initiating Universal iOS Fallback Engine:', e);
      // Attempt automated Web Audio transcoding fallback
      try {
        setIsTranscoding(true);
        if (!webAudioPlayerRef.current) {
          webAudioPlayerRef.current = new WebAudioStreamPlayer();
        }
        const decodedDuration = await webAudioPlayerRef.current.load(src);
        setDuration(decodedDuration || fallbackDuration || 0);
        setPlaybackMode('WEB_AUDIO');
        setHasError(false);
        setIsTranscoding(false);
      } catch (fallbackErr: any) {
        console.error('[AudioPlayer] Web Audio fallback also failed:', fallbackErr);
        setIsTranscoding(false);
        setHasError(true);
        setErrorMessage(
          language === 'fa'
            ? 'امکان رمزگشایی صوت در این دستگاه وجود ندارد'
            : 'Unable to play this audio format on this device'
        );
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [activeSrc, playbackMode, onEnded, fallbackDuration, src, language]);

  // Clean up WebAudioPlayer on unmount
  useEffect(() => {
    return () => {
      if (webAudioPlayerRef.current) {
        webAudioPlayerRef.current.destroy();
        webAudioPlayerRef.current = null;
      }
    };
  }, []);

  const handleManualConvertAndPlay = async () => {
    setIsTranscoding(true);
    setHasError(false);
    try {
      const result = await transcodeToCompatibleWav(src);
      setActiveSrc(result.objectUrl || result.dataUrl);
      setDuration(result.duration || fallbackDuration || 0);
      setPlaybackMode('HTML5');
      setIsTranscoding(false);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.warn('[AudioPlayer] Manual transcode to WAV failed, using Web Audio directly:', err);
      try {
        if (!webAudioPlayerRef.current) {
          webAudioPlayerRef.current = new WebAudioStreamPlayer();
        }
        const decodedDuration = await webAudioPlayerRef.current.load(src);
        setDuration(decodedDuration || fallbackDuration || 0);
        setPlaybackMode('WEB_AUDIO');
        setIsTranscoding(false);
        webAudioPlayerRef.current.play(
          () => {
            setIsPlaying(false);
            setCurrentTime(0);
            onEnded?.();
          },
          (curr) => setCurrentTime(curr)
        );
        setIsPlaying(true);
      } catch (finalErr) {
        setIsTranscoding(false);
        setHasError(true);
      }
    }
  };

  const togglePlay = () => {
    if (playbackMode === 'WEB_AUDIO') {
      const player = webAudioPlayerRef.current;
      if (!player) return;
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play(
          () => {
            setIsPlaying(false);
            setCurrentTime(0);
            onEnded?.();
          },
          (curr) => setCurrentTime(curr)
        );
        setIsPlaying(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn('[AudioPlayer] HTML5 audio.play() prevented:', err);
        handleManualConvertAndPlay();
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * (duration || 1);

    if (playbackMode === 'WEB_AUDIO') {
      if (webAudioPlayerRef.current) {
        webAudioPlayerRef.current.seek(newTime);
        setCurrentTime(newTime);
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);

    if (playbackMode === 'WEB_AUDIO') {
      webAudioPlayerRef.current?.setPlaybackRate(nextRate);
    } else if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = activeSrc || src;
      const isWav = (activeSrc || src).includes('audio/wav') || (activeSrc || src).endsWith('.wav');
      a.download = `${title || 'voice-note'}-${new Date().toISOString().slice(0, 10)}.${isWav ? 'wav' : 'webm'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform visualization bars
  const waveBarsCount = compact ? 18 : 32;
  const waveformHeights = [
    25, 45, 60, 30, 75, 90, 65, 40, 85, 100, 70, 50, 80, 95, 60, 35, 70, 85, 45, 60, 75, 90, 55, 35,
    65, 80, 40, 60, 75, 50, 30, 20,
  ];

  if (hasError) {
    return (
      <div
        className={cn(
          'rounded-2xl border p-3 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs',
          className
        )}
      >
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage || (language === 'fa' ? 'امکان پخش این صوت در این دستگاه وجود ندارد' : 'Cannot play this voice note on this device')}</span>
        </div>
        <button
          type="button"
          onClick={handleManualConvertAndPlay}
          disabled={isTranscoding}
          className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5 shrink-0 transition-all"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isTranscoding && 'animate-spin')} />
          <span>{language === 'fa' ? 'تبدیل و تلاش مجدد' : 'Convert & Play'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all select-none',
        compact
          ? 'p-2.5 bg-slate-100/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 flex items-center gap-2.5'
          : 'p-3.5 bg-white/95 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800/80 shadow-md backdrop-blur-md space-y-2.5',
        className
      )}
      dir="ltr"
    >
      {playbackMode === 'HTML5' && (
        <audio ref={audioRef} src={activeSrc} preload="metadata" playsInline />
      )}

      {compact ? (
        <>
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isTranscoding}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30 transition-transform active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? (language === 'fa' ? 'توقف' : 'Pause') : (language === 'fa' ? 'پخش' : 'Play')}
          >
            {isTranscoding ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Interactive Mini Waveform Bar */}
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="flex-1 flex items-center gap-[2px] h-6 cursor-pointer py-1 group relative"
            title={language === 'fa' ? 'کلیک برای پرش در فایل صوتی' : 'Click to seek in audio'}
          >
            {waveformHeights.slice(0, waveBarsCount).map((height, i) => {
              const barPercent = (i / waveBarsCount) * 100;
              const isPassed = barPercent <= progressPercent;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-full transition-all duration-150',
                    isPassed
                      ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 shadow-sm shadow-indigo-500/50'
                      : 'bg-slate-300 dark:bg-slate-700/60 group-hover:bg-slate-400 dark:group-hover:bg-slate-600/70'
                  )}
                  style={{ height: `${Math.max(20, height)}%` }}
                />
              );
            })}
          </div>

          {/* Time tracker */}
          <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
            {formatTime(currentTime)}
          </div>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shrink-0"
            title={language === 'fa' ? 'سرعت پخش' : 'Playback Speed'}
          >
            {playbackRate}x
          </button>
        </>
      ) : (
        <>
          {/* Header info if title provided */}
          {title && (
            <div className="flex items-center justify-between text-xs text-slate-900 dark:text-slate-100 font-semibold px-1" dir={isRtl ? 'rtl' : 'ltr'}>
              <span className="truncate">{title}</span>
              <div className="flex items-center gap-1.5">
                {isIosOrSafari() && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    iOS Ready
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-500">
                  {language === 'fa' ? 'صوت' : 'Audio'}
                </span>
              </div>
            </div>
          )}

          {/* Waveform Bar */}
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="flex items-center gap-[3px] h-9 cursor-pointer py-1 px-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800/80 group relative transition-colors hover:border-slate-300 dark:hover:border-slate-700"
            title={language === 'fa' ? 'برای جابجایی در صدا کلیک کنید' : 'Click to seek'}
          >
            {waveformHeights.slice(0, waveBarsCount).map((height, i) => {
              const barPercent = (i / waveBarsCount) * 100;
              const isPassed = barPercent <= progressPercent;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-full transition-all duration-100',
                    isPassed
                      ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 shadow-sm shadow-indigo-500/40'
                      : 'bg-slate-300 dark:bg-slate-700/50 group-hover:bg-slate-400 dark:group-hover:bg-slate-600/60'
                  )}
                  style={{ height: `${Math.max(18, height)}%` }}
                />
              );
            })}
          </div>

          {/* Controls Bottom Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                disabled={isTranscoding}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 transition-transform active:scale-95 disabled:opacity-50"
                aria-label={isPlaying ? (language === 'fa' ? 'توقف' : 'Pause') : (language === 'fa' ? 'پخش' : 'Play')}
              >
                {isTranscoding ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Time display */}
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                <span className="text-slate-600 dark:text-slate-400">{formatTime(duration || fallbackDuration || 0)}</span>
              </div>
            </div>

            {/* Right Tools (Speed, Mute, Download) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="text-[11px] font-bold font-mono px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-slate-300 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title={language === 'fa' ? 'تغییر سرعت پخش' : 'Change playback speed'}
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors"
                title={isMuted ? (language === 'fa' ? 'صدادار کردن' : 'Unmute') : (language === 'fa' ? 'بی‌صدا کردن' : 'Mute')}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500 dark:text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {showDownload && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors"
                  title={language === 'fa' ? 'دانلود فایل صوتی' : 'Download audio'}
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
