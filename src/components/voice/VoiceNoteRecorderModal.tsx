import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Customer, VoiceNote, VoiceNoteCategory } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { AudioPlayer } from '../ui/AudioPlayer';
import { useAudioRecorder } from '../../lib/audioRecorder';
import { useSpeechRecognition } from '../../lib/speechRecognition';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import {
  Mic, Square, Pause, Play, RotateCcw, Sparkles, Check,
  Volume2, Tag, CheckSquare, AlertCircle, AlertTriangle, RefreshCw,
  FileAudio, Upload, Music, Settings, HelpCircle, ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';

export interface VoiceNoteRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  onSaved: (voiceNote: VoiceNote) => void;
  initialMode?: 'RECORD' | 'UPLOAD';
}

export const VoiceNoteRecorderModal: React.FC<VoiceNoteRecorderModalProps> = ({
  isOpen,
  onClose,
  initialCustomer,
  allCustomers = [],
  onSaved,
  initialMode = 'RECORD',
}) => {
  const { language, isRtl } = useTranslation();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'RECORD' | 'UPLOAD'>(initialMode);
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState<VoiceNoteCategory>(VoiceNoteCategory.CUSTOMER_NOTE);
  const [transcription, setTranscription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);
  const [followUpDueDate, setFollowUpDueDate] = useState('');
  const [autoTranscribe, setAutoTranscribe] = useState(true);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedAudioDataUrl, setUploadedAudioDataUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Audio Recorder Hook
  const {
    status: recorderStatus,
    isRecording,
    isPaused,
    isRequestingPermission,
    isProcessing,
    recordingDuration,
    audioUrl,
    audioDataUrl,
    audioLevels,
    error: recorderError,
    errorInfo,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    resetAudio,
    retryPermission,
  } = useAudioRecorder();

  // Speech Recognition for live text transcription
  const {
    startListening,
    stopListening,
    isSupported: speechSupported,
  } = useSpeechRecognition({
    language: 'fa-IR',
    continuous: true,
    onResult: (text) => {
      if (autoTranscribe) {
        setTranscription(text);
      }
    },
  });

  // Reset or preset on open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'RECORD');
      if (initialCustomer) {
        setCustomerId(initialCustomer.id);
        setTitle(isRtl ? `یادداشت صوتی - ${initialCustomer.name}` : `Voice Note - ${initialCustomer.name}`);
      } else if (allCustomers.length > 0) {
        setCustomerId(allCustomers[0].id);
        setTitle(isRtl ? `یادداشت صوتی - ${new Date().toLocaleDateString('fa-IR')}` : `Voice Note - ${new Date().toLocaleDateString('en-US')}`);
      } else {
        setTitle(isRtl ? `یادداشت صوتی - ${new Date().toLocaleDateString('fa-IR')}` : `Voice Note - ${new Date().toLocaleDateString('en-US')}`);
      }
      setCategory(VoiceNoteCategory.CUSTOMER_NOTE);
      setTranscription('');
      setTags([isRtl ? 'صوتی' : 'voice']);
      setCreateFollowUpTask(false);
      setUploadedAudioDataUrl(null);
      setUploadedAudioUrl(null);
      setUploadedFileName(null);
      setUploadedDuration(0);
      resetAudio();
    } else {
      cancelRecording();
      stopListening();
    }
  }, [isOpen, initialCustomer, allCustomers, initialMode, cancelRecording, resetAudio, stopListening]);

  // Handle start recording triggered directly on user click
  const handleStartRecording = async () => {
    const started = await startRecording();
    if (started) {
      if (autoTranscribe && speechSupported) {
        try {
          startListening();
        } catch (e) {
          console.warn('Live speech recognition warning:', e);
        }
      }
    } else {
      if (errorInfo?.message) {
        toastError(errorInfo.message);
      }
    }
  };

  const handleStopRecording = async () => {
    stopListening();
    await stopRecording();
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      resumeRecording();
      if (autoTranscribe && speechSupported) startListening();
    } else {
      pauseRecording();
      stopListening();
    }
  };

  const handleReRecord = () => {
    stopListening();
    cancelRecording();
    setTranscription('');
  };

  // Upload file handlers
  const handleProcessAudioFile = (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|webm|opus|flac)$/i)) {
      toastError(isRtl ? 'لطفاً یک فایل صوتی معتبر (MP3, WAV, M4A, OGG, WebM) انتخاب نمایید.' : 'Please select a valid audio file (MP3, WAV, M4A, OGG, WebM).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toastError(isRtl ? 'حداکثر حجم فایل صوتی مجاز ۲۵ مگابایت است.' : 'Maximum allowed audio file size is 25 MB.');
      return;
    }

    setUploadedFileName(file.name);
    if (!title || title.startsWith(isRtl ? 'یادداشت صوتی' : 'Voice Note')) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setTitle(isRtl ? `صوت بارگذاری شده: ${cleanName}` : `Uploaded audio: ${cleanName}`);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedAudioDataUrl(result);
      const url = URL.createObjectURL(file);
      setUploadedAudioUrl(url);

      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        const dur = Math.round(tempAudio.duration);
        setUploadedDuration(dur > 0 ? dur : 15);
      };
      tempAudio.onerror = () => {
        setUploadedDuration(15);
      };
    };
    reader.readAsDataURL(file);
    success(isRtl ? `فایل صوتی «${file.name}» با موفقیت بارگذاری شد` : `Audio file "${file.name}" uploaded successfully`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessAudioFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessAudioFile(file);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const activeAudioData = mode === 'RECORD' ? audioDataUrl : uploadedAudioDataUrl;
  const activeDuration = mode === 'RECORD' ? (recordingDuration || 1) : (uploadedDuration || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeAudioData) {
      toastError(mode === 'RECORD' ? (isRtl ? 'لطفاً ابتدا صدای خود را ضبط کنید' : 'Please record your audio first') : (isRtl ? 'لطفاً یک فایل صوتی بارگذاری نمایید' : 'Please upload an audio file'));
      return;
    }

    if (!title.trim()) {
      toastError(isRtl ? 'لطفاً عنوان یادداشت صوتی را وارد نمایید' : 'Please enter a title for the voice note');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);

    const saved = storage.saveVoiceNote({
      title: title.trim(),
      customerId: selectedCust?.id,
      customerName: selectedCust?.name,
      audioDataUrl: activeAudioData,
      durationSeconds: activeDuration,
      transcription: transcription.trim(),
      category,
      tags,
      relatedEntityType: selectedCust ? 'CUSTOMER' : 'GENERAL',
      relatedEntityId: selectedCust?.id,
    });

    if (createFollowUpTask && selectedCust) {
      storage.saveTask({
        id: '',
        title: `پیگیری یادداشت صوتی: ${title.trim()}`,
        description: transcription.trim()
          ? `متن یادداشت: ${transcription.trim()}`
          : `دارای فایل صوتی ضمیمه در پرونده مشتری (${activeDuration} ثانیه)`,
        customerId: selectedCust.id,
        customerName: selectedCust.name,
        assignedUserId: storage.getCurrentUser().id,
        assignedUserName: storage.getCurrentUser().name,
        creatorUserId: storage.getCurrentUser().id,
        creatorUserName: storage.getCurrentUser().name,
        priority: 'HIGH' as any,
        status: 'PENDING' as any,
        dueDate: followUpDueDate || new Date(Date.now() + 86400000).toISOString(),
        createdAt: '',
        updatedAt: '',
      });
    }

    success(isRtl ? 'یادداشت صوتی با موفقیت ذخیره شد' : 'Voice note saved successfully');
    onSaved(saved);
    onClose();
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render Status Badge
  const renderStatusBadge = () => {
    switch (recorderStatus) {
      case 'requesting_permission':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {isRtl ? 'در حال درخواست مجوز میکروفون از مرورگر...' : 'Requesting microphone permission from browser...'}
          </span>
        );
      case 'recording':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            {isRtl ? 'در حال ضبط زنده صدا...' : 'Recording live audio...'}
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            {isRtl ? 'مکث ضبط صدا' : 'Recording Paused'}
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            {isRtl ? 'در حال پردازش و آماده‌سازی صوت...' : 'Processing audio...'}
          </span>
        );
      case 'recorded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {isRtl ? 'صوت با موفقیت ضبط شد' : 'Audio recorded successfully'}
          </span>
        );
      case 'permission_denied':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            {isRtl ? 'دسترسی به میکروفون مسدود شده است' : 'Microphone access denied'}
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {isRtl ? 'میکروفون در دسترس نیست' : 'Microphone not available'}
          </span>
        );
      case 'unsupported':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            {isRtl ? 'عدم پشتیبانی مرورگر' : 'Browser not supported'}
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 font-medium">{isRtl ? 'آماده شروع ضبط صدا' : 'Ready to record'}</span>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <Mic className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-slate-100">{isRtl ? 'ثبت یادداشت صوتی' : 'Record Voice Note'}</span>
        </div>
      }
      subtitle={isRtl ? 'امکان ضبط زنده با میکروفون یا بارگذاری فایل‌های صوتی مکالمات و الصاق به پرونده‌ها' : 'Live microphone recording or audio file uploads, attached to records'}
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-end">
        {/* Mode Selector (Record vs Upload) */}
        <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setMode('RECORD')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'RECORD'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{isRtl ? 'ضبط زنده با میکروفون' : 'Live Microphone Recording'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('UPLOAD')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'UPLOAD'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isRtl ? 'آپلود فایل صوتی' : 'Upload Audio File'}</span>
          </button>
        </div>

        {/* Studio Card (Live Recording Mode) */}
        {mode === 'RECORD' && (
          <div className="p-5 rounded-3xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-4">
            {/* Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">{isRtl ? 'وضعیت:' : 'Status:'}</span>
                {renderStatusBadge()}
              </div>

              {/* Timer */}
              <div className="font-mono text-sm font-bold text-slate-200 tabular-nums px-3 py-1 rounded-xl bg-slate-900 border border-slate-800">
                {formatSeconds(recordingDuration)}
              </div>
            </div>

            {/* Permission Prompt Banner if browser popup is opening */}
            {isRequestingPermission && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300 animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-200">{isRtl ? 'درخواست دسترسی به میکروفون در مرورگر' : 'Microphone permission requested in browser'}</p>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    {isRtl ? 'لطفاً در پنجره باز شده در بالای صفحه مرورگر روی دکمه' : 'In the popup at the top of the browser, click'}{' '}<strong>Allow</strong>{isRtl ? ' کلیک کنید تا ضبط صدا آغاز گردد.' : ' to start recording.'}
                  </p>
                </div>
              </div>
            )}

            {/* Error & Instructions Card if Permission Denied or Hardware Issue */}
            {errorInfo && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-xs text-rose-200 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-rose-200">{errorInfo.message}</p>
                    {errorInfo.instructions && errorInfo.instructions.length > 0 && (
                      <ul className="text-[11px] text-rose-300/90 list-disc list-inside space-y-1 pt-1">
                        {errorInfo.instructions.map((inst, i) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {errorInfo.canRetry && (
                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={retryPermission}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      {isRtl ? 'تلاش مجدد و فعال‌سازی میکروفون' : 'Retry & Enable Microphone'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Visualizer Waveform or Audio Player */}
            {isRecording ? (
              <div className="h-20 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center px-4 gap-1.5 overflow-hidden" dir="ltr">
                {audioLevels.map((lvl, idx) => (
                  <motion.div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-rose-500 via-indigo-500 to-sky-400 rounded-full"
                    animate={{ height: `${Math.max(12, lvl)}%` }}
                    transition={{ duration: 0.08, ease: 'linear' }}
                  />
                ))}
              </div>
            ) : audioUrl ? (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">{isRtl ? 'پیش‌نمایش صوت ضبط شده:' : 'Recorded audio preview:'}</span>
                <AudioPlayer src={audioUrl} duration={recordingDuration} title={title || (isRtl ? 'پیش‌نمایش یادداشت صوتی' : 'Voice note preview')} />
              </div>
            ) : (
              <div className="h-20 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                <Volume2 className="w-6 h-6 text-slate-600" />
                <span>{isRtl ? 'برای شروع ضبط دکمه قرمز زیر را فشار دهید (مرورگر از شما اجازه دسترسی می‌خواهد)' : 'Press the red button below to start recording (browser will request permission)'}</span>
              </div>
            )}

            {/* Recorder Controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {!isRecording && !audioDataUrl && (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={isRequestingPermission || isProcessing}
                  onClick={handleStartRecording}
                  leftIcon={<Mic className="w-5 h-5" />}
                  className="px-6 shadow-rose-600/30"
                >
                  {isRequestingPermission ? (isRtl ? 'در حال درخواست مجوز...' : 'Requesting permission...') : (isRtl ? 'شروع ضبط صدا' : 'Start Recording')}
                </Button>
              )}

              {isRecording && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePauseToggle}
                    leftIcon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  >
                    {isPaused ? (isRtl ? 'ادامه ضبط' : 'Resume Recording') : (isRtl ? 'مکث' : 'Pause')}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleStopRecording}
                    leftIcon={<Square className="w-4 h-4 fill-current" />}
                    className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  >
                    {isRtl ? 'پایان و بازبینی' : 'Finish & Review'}
                  </Button>
                </>
              )}

              {audioDataUrl && !isRecording && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReRecord}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  {isRtl ? 'ضبط مجدد' : 'Re-record'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Upload Audio File Mode */}
        {mode === 'UPLOAD' && (
          <div className="p-5 rounded-3xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm,.opus,.flac"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!uploadedAudioDataUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-slate-900/70'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-2.5 border border-indigo-500/30">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-200">
                  {isRtl ? 'فایل صوتی خود را اینجا بکشید یا برای انتخاب کلیک کنید' : 'Drag your audio file here or click to select'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isRtl ? 'پشتیبانی از فرمت‌های MP3, WAV, M4A, AAC, OGG, WebM (حداکثر ۲۵ مگابایت)' : 'Supports MP3, WAV, M4A, AAC, OGG, WebM (max 25 MB)'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 truncate max-w-[260px]">
                        {uploadedFileName}
                      </div>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" />
                        <span>{isRtl ? 'مدت تقریبی:' : 'Duration:'} {formatSeconds(uploadedDuration)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    {isRtl ? 'تغییر فایل' : 'Change File'}
                  </Button>
                </div>

                {uploadedAudioUrl && (
                  <AudioPlayer
                    src={uploadedAudioUrl}
                    duration={uploadedDuration}
                    title={title || uploadedFileName || (isRtl ? 'فایل صوتی بارگذاری شده' : 'Uploaded audio file')}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Note Metadata Fields */}
        <div className="space-y-3.5">
          <Input
            label={isRtl ? 'عنوان یادداشت صوتی' : 'Voice Note Title'}
            placeholder={isRtl ? 'مثال: توافقات جلسه تخفیف سیم‌کارت دکتر کاظمی' : 'e.g. Meeting notes - Dr. Kazemi SIM discount'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            isRequired
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRtl ? 'مشتری یا پرونده مرتبط:' : 'Linked customer or record:'}
              </label>
              <Select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={[
                  { value: '', label: isRtl ? 'بدون ارتباط به مشتری خاص (یادداشت عمومی)' : 'No customer (general note)' },
                  ...(allCustomers || []).map((c) => ({
                    value: c.id,
                    label: `${c.name} ${c.companyName ? `(${c.companyName})` : ''}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRtl ? 'دسته‌بندی موضوعی:' : 'Category:'}
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as VoiceNoteCategory)}
                options={[
                  { value: VoiceNoteCategory.CUSTOMER_NOTE, label: isRtl ? 'یادداشت پرونده مشتری' : 'Customer Record Note' },
                  { value: VoiceNoteCategory.CALL_MEMO, label: isRtl ? 'شرح مذاکره و تماس تلفنی' : 'Call Memo' },
                  { value: VoiceNoteCategory.TASK_INSTRUCTION, label: isRtl ? 'دستور کار و پیگیری وظیفه' : 'Task Instruction' },
                  { value: VoiceNoteCategory.REPAIR_DIAGNOSIS, label: isRtl ? 'عیب‌یابی کارگاه تعمیرات' : 'Repair Diagnosis' },
                  { value: VoiceNoteCategory.PAYMENT_APPROVAL, label: isRtl ? 'دستور پرداخت و تایید مالی' : 'Payment Approval' },
                  { value: VoiceNoteCategory.INTERNAL_MEMO, label: isRtl ? 'یادداشت درون‌سازمانی' : 'Internal Memo' },
                  { value: VoiceNoteCategory.GENERAL, label: isRtl ? 'عمومی و متفرقه' : 'General' },
                ]}
              />
            </div>
          </div>

          {/* Persian Speech-to-Text Transcription */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isRtl ? 'متن پیاده‌شده گفتار / خلاصه‌نویسی:' : 'Speech-to-Text / Summary:'}</span>
              </label>

              {speechSupported && mode === 'RECORD' && (
                <Checkbox
                  checked={autoTranscribe}
                  onChange={(e) => setAutoTranscribe(e.target.checked)}
                  label="{isRtl ? 'تبدیل خودکار گفتار فارسی به متن' : 'Auto transcribe Persian speech to text'}"
                  colorScheme="indigo"
                  size="sm"
                />
              )}
            </div>

            <Textarea
              placeholder={isRtl ? 'متن پیاده‌شده فایل صوتی یا یادداشت‌های مهم مذاکره را اینجا وارد یا ویرایش نمایید...' : 'Enter transcribed audio text or key meeting notes here...'}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>{isRtl ? 'برچسب‌ها (با کلید اینتر اضافه کنید):' : 'Tags (press Enter to add):'}</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-slate-950 border border-slate-800 min-h-[42px]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400 text-slate-400 me-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={isRtl ? 'افزودن برچسب جدید...' : 'Add new tag...'}
                className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none flex-1 min-w-[120px]"
              />
            </div>
          </div>

          {/* Follow-up task shortcut */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <Checkbox
              checked={createFollowUpTask}
              onChange={(e) => setCreateFollowUpTask(e.target.checked)}
              label="{isRtl ? 'تعریف خودکار وظیفه و اقدام پیگیری برای این یادداشت صوتی' : 'Auto-create follow-up task for this voice note'}"
              icon={<CheckSquare className="w-3.5 h-3.5 text-emerald-400" />}
              colorScheme="emerald"
              size="md"
            />

            {createFollowUpTask && (
              <div className="pt-2 animate-fade-in">
                <JalaliDatePicker
                  label={isRtl ? 'مهلت انجام وظیفه (شمسی - اختیاری)' : 'Task Due Date (optional)'}
                  value={followUpDueDate}
                  onChange={(val) => setFollowUpDueDate(val)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="outline" size="md" type="button" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={!activeAudioData}
            leftIcon={<Check className="w-4 h-4" />}
            className="shadow-indigo-600/30"
          >
            {isRtl ? 'ذخیره نهایی یادداشت صوتی' : 'Save Voice Note'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
