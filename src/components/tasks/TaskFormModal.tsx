import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Task, TaskPriority, TaskStatus, Customer, User, VoiceNote, VoiceNoteCategory } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { AudioPlayer } from '../ui/AudioPlayer';
import { useAudioRecorder } from '../../lib/audioRecorder';
import { useSpeechRecognition } from '../../lib/speechRecognition';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import {
  CheckSquare, User as UserIcon, Calendar, Check, AlertTriangle, RotateCcw,
  Share2, Users, Clock, Zap, Mic, Square, Pause, Play, Trash2, Upload, FileAudio,
  Volume2, Sparkles, ShieldAlert, RefreshCw, AlertCircle
} from 'lucide-react';
import { formatPersianDate } from '../../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  allUsers: User[];
  onSaved: (task: Task) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialCustomer,
  allCustomers = [],
  allUsers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [sharedWithUserIds, setSharedWithUserIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [dueDate, setDueDate] = useState('');
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Voice Note State
  const [voiceNoteAudioUrl, setVoiceNoteAudioUrl] = useState<string | null>(null);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number>(0);
  const [voiceNoteTranscript, setVoiceNoteTranscript] = useState<string>('');
  const [isVoiceSectionOpen, setIsVoiceSectionOpen] = useState(false);
  const [voiceInputMode, setVoiceInputMode] = useState<'RECORD' | 'UPLOAD'>('RECORD');
  const [autoTranscribeToDescription, setAutoTranscribeToDescription] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftKey = taskToEdit ? `draft_task_${taskToEdit.id}` : 'draft_task_new';
  const isInitialMount = useRef(true);

  // Audio Recorder Hook
  const {
    status: recorderStatus,
    isRecording,
    isPaused,
    isRequestingPermission,
    recordingDuration,
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

  // Speech Recognition for live transcription
  const {
    startListening,
    stopListening,
    isSupported: speechSupported,
  } = useSpeechRecognition({
    language: 'fa-IR',
    continuous: true,
    onResult: (text) => {
      setVoiceNoteTranscript(text);
      if (autoTranscribeToDescription) {
        setDescription((prev) => (prev ? `${prev} ${text}` : text));
      }
    },
  });

  // Keep track when recorded audio finishes
  useEffect(() => {
    if (audioDataUrl) {
      setVoiceNoteAudioUrl(audioDataUrl);
      setVoiceNoteDuration(recordingDuration);
    }
  }, [audioDataUrl, recordingDuration]);

  // Initialize form or restore saved draft
  useEffect(() => {
    if (!isOpen) {
      setHasRestoredDraft(false);
      isInitialMount.current = true;
      cancelRecording();
      stopListening();
      return;
    }

    isInitialMount.current = true;
    const savedDraft = storage.getDraft(draftKey);

    if (taskToEdit) {
      if (savedDraft) {
        setTitle(savedDraft.title ?? taskToEdit.title ?? '');
        setDescription(savedDraft.description ?? taskToEdit.description ?? '');
        setCustomerId(savedDraft.customerId ?? taskToEdit.customerId ?? '');
        setAssignedUserId(savedDraft.assignedUserId ?? taskToEdit.assignedUserId ?? '');
        setSharedWithUserIds(savedDraft.sharedWithUserIds ?? taskToEdit.sharedWithUserIds ?? []);
        setPriority(savedDraft.priority ?? taskToEdit.priority ?? TaskPriority.MEDIUM);
        setStatus(savedDraft.status ?? taskToEdit.status ?? TaskStatus.PENDING);
        setDueDate(savedDraft.dueDate ?? (taskToEdit.dueDate ? taskToEdit.dueDate.substring(0, 16) : ''));
        setVoiceNoteAudioUrl(savedDraft.voiceNoteAudioUrl ?? taskToEdit.voiceNoteAudioUrl ?? null);
        setVoiceNoteDuration(savedDraft.voiceNoteDuration ?? taskToEdit.voiceNoteDuration ?? 0);
        setVoiceNoteTranscript(savedDraft.voiceNoteTranscript ?? taskToEdit.voiceNoteTranscript ?? '');
        setIsVoiceSectionOpen(Boolean(savedDraft.voiceNoteAudioUrl ?? taskToEdit.voiceNoteAudioUrl));
        setHasRestoredDraft(true);
      } else {
        setTitle(taskToEdit.title || '');
        setDescription(taskToEdit.description || '');
        setCustomerId(taskToEdit.customerId || '');
        setAssignedUserId(taskToEdit.assignedUserId || '');
        setSharedWithUserIds(taskToEdit.sharedWithUserIds || []);
        setPriority(taskToEdit.priority || TaskPriority.MEDIUM);
        setStatus(taskToEdit.status || TaskStatus.PENDING);
        setDueDate(taskToEdit.dueDate ? taskToEdit.dueDate.substring(0, 16) : '');
        setVoiceNoteAudioUrl(taskToEdit.voiceNoteAudioUrl || null);
        setVoiceNoteDuration(taskToEdit.voiceNoteDuration || 0);
        setVoiceNoteTranscript(taskToEdit.voiceNoteTranscript || '');
        setIsVoiceSectionOpen(Boolean(taskToEdit.voiceNoteAudioUrl));
        setHasRestoredDraft(false);
      }
    } else {
      if (savedDraft && (savedDraft.title || savedDraft.description || savedDraft.voiceNoteAudioUrl)) {
        setTitle(savedDraft.title || '');
        setDescription(savedDraft.description || '');
        setCustomerId(savedDraft.customerId || initialCustomer?.id || '');
        setAssignedUserId(savedDraft.assignedUserId || storage.getCurrentUser().id);
        setSharedWithUserIds(savedDraft.sharedWithUserIds || []);
        setPriority(savedDraft.priority || TaskPriority.MEDIUM);
        setStatus(savedDraft.status || TaskStatus.PENDING);
        setDueDate(savedDraft.dueDate || '');
        setVoiceNoteAudioUrl(savedDraft.voiceNoteAudioUrl || null);
        setVoiceNoteDuration(savedDraft.voiceNoteDuration || 0);
        setVoiceNoteTranscript(savedDraft.voiceNoteTranscript || '');
        setIsVoiceSectionOpen(Boolean(savedDraft.voiceNoteAudioUrl));
        setHasRestoredDraft(true);
      } else {
        setTitle('');
        setDescription('');
        setCustomerId(initialCustomer?.id || '');
        const currentUser = storage.getCurrentUser();
        setAssignedUserId(currentUser.id);
        setSharedWithUserIds([]);
        setPriority(TaskPriority.MEDIUM);
        setStatus(TaskStatus.PENDING);
        setVoiceNoteAudioUrl(null);
        setVoiceNoteDuration(0);
        setVoiceNoteTranscript('');
        setIsVoiceSectionOpen(false);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0);
        setDueDate(tomorrow.toISOString().substring(0, 16));
        setHasRestoredDraft(false);
      }
    }

    resetAudio();

    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [taskToEdit, initialCustomer, isOpen, draftKey]);

  // Auto-save form draft on change
  useEffect(() => {
    if (!isOpen || isInitialMount.current) return;

    const hasContent = !!(title || description || voiceNoteAudioUrl);

    if (hasContent) {
      const handler = setTimeout(() => {
        storage.saveDraft(draftKey, {
          title,
          description,
          customerId,
          assignedUserId,
          sharedWithUserIds,
          priority,
          status,
          dueDate,
          voiceNoteAudioUrl,
          voiceNoteDuration,
          voiceNoteTranscript,
        });
      }, 300);

      return () => clearTimeout(handler);
    }
  }, [title, description, customerId, assignedUserId, sharedWithUserIds, priority, status, dueDate, voiceNoteAudioUrl, voiceNoteDuration, voiceNoteTranscript, isOpen, draftKey]);

  const handleClearDraft = () => {
    storage.clearDraft(draftKey);
    setHasRestoredDraft(false);
    cancelRecording();
    stopListening();
    resetAudio();

    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setCustomerId(taskToEdit.customerId || '');
      setAssignedUserId(taskToEdit.assignedUserId || '');
      setSharedWithUserIds(taskToEdit.sharedWithUserIds || []);
      setPriority(taskToEdit.priority || TaskPriority.MEDIUM);
      setStatus(taskToEdit.status || TaskStatus.PENDING);
      setDueDate(taskToEdit.dueDate ? taskToEdit.dueDate.substring(0, 16) : '');
      setVoiceNoteAudioUrl(taskToEdit.voiceNoteAudioUrl || null);
      setVoiceNoteDuration(taskToEdit.voiceNoteDuration || 0);
      setVoiceNoteTranscript(taskToEdit.voiceNoteTranscript || '');
    } else {
      setTitle('');
      setDescription('');
      setCustomerId(initialCustomer?.id || '');
      const currentUser = storage.getCurrentUser();
      setAssignedUserId(currentUser.id);
      setSharedWithUserIds([]);
      setPriority(TaskPriority.MEDIUM);
      setStatus(TaskStatus.PENDING);
      setVoiceNoteAudioUrl(null);
      setVoiceNoteDuration(0);
      setVoiceNoteTranscript('');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      setDueDate(tomorrow.toISOString().substring(0, 16));
    }
    success(isRtl ? 'پیش‌نویس پاک شد و فرم بازنشانی گردید' : 'Draft cleared and form reset');
  };

  const handleToggleShared = (userId: string) => {
    setSharedWithUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Live recording handlers
  const handleStartTaskVoiceRecording = async () => {
    const started = await startRecording();
    if (started) {
      if (speechSupported) {
        try {
          startListening();
        } catch (e) {}
      }
    } else {
      error(recorderError || (isRtl ? 'دسترسی به میکروفون میسر نشد. لطفاً مجوز مرورگر را بررسی نمایید.' : 'Microphone access failed. Please check your browser permissions.'));
    }
  };

  const handleStopTaskVoiceRecording = async () => {
    stopListening();
    const result = await stopRecording();
    if (result) {
      setVoiceNoteAudioUrl(result.dataUrl);
      setVoiceNoteDuration(result.duration);
      success(isRtl ? 'یادداشت صوتی با موفقیت ضبط شد' : 'Voice note recorded successfully');
    }
  };

  const handlePauseToggleRecording = () => {
    if (isPaused) {
      resumeRecording();
      if (speechSupported) startListening();
    } else {
      pauseRecording();
      stopListening();
    }
  };

  const handleCancelVoiceRecording = () => {
    stopListening();
    cancelRecording();
    resetAudio();
    setVoiceNoteAudioUrl(null);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
  };

  const handleProcessAudioFile = (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|webm|opus|flac)$/i)) {
      error(isRtl ? 'لطفاً یک فایل صوتی معتبر (MP3, WAV, M4A, OGG, WebM) انتخاب نمایید.' : 'Please select a valid audio file (MP3, WAV, M4A, OGG, WebM).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      error(isRtl ? 'حداکثر حجم مجاز فایل صوتی ۲۵ مگابایت است.' : 'The maximum allowed audio file size is 25 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setVoiceNoteAudioUrl(result);

      // Probe duration
      const tempAudio = new Audio();
      tempAudio.src = result;
      tempAudio.onloadedmetadata = () => {
        const dur = Math.round(tempAudio.duration) || 10;
        setVoiceNoteDuration(dur);
      };

      success(isRtl ? `فایل صوتی ${file.name} پیوست شد` : `Audio file ${file.name} attached`);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      error(isRtl ? 'لطفاً عنوان وظیفه را مشخص کنید' : 'Please specify the task title.');
      return;
    }
    if (!dueDate) {
      error(isRtl ? 'لطفاً مهلت سررسید را تعیین کنید' : 'Please set a due date.');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);
    const selectedUser = allUsers.find((u) => u.id === assignedUserId);
    const currentUser = storage.getCurrentUser();

    // Clean shared users to exclude the main assigned user
    const cleanedSharedIds = sharedWithUserIds.filter((id) => id !== (assignedUserId || currentUser.id));
    const cleanedSharedNames = cleanedSharedIds
      .map((id) => allUsers.find((u) => u.id === id)?.name)
      .filter((n): n is string => Boolean(n));

    const taskId = taskToEdit?.id || `tsk_${Date.now()}`;

    // If a voice note was recorded/attached, also register a unified VoiceNote entity
    let linkedVoiceNoteId = taskToEdit?.voiceNoteId;
    if (voiceNoteAudioUrl) {
      try {
        const savedVN = storage.saveVoiceNote({
          id: linkedVoiceNoteId || '',
          title: isRtl ? `دستور صوتی وظیفه: ${title.trim()}` : `Task voice instruction: ${title.trim()}`,
          audioDataUrl: voiceNoteAudioUrl,
          durationSeconds: voiceNoteDuration || 10,
          transcription: voiceNoteTranscript || description || undefined,
          customerId: customerId || undefined,
          customerName: selectedCust?.name || undefined,
          createdById: currentUser.id,
          createdByName: currentUser.name,
          category: VoiceNoteCategory.TASK_INSTRUCTION,
          tags: [isRtl ? 'دستور صوتی' : 'voice-order', isRtl ? 'وظیفه' : 'task'],
          relatedEntityType: 'TASK',
          relatedEntityId: taskId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        linkedVoiceNoteId = savedVN.id;
      } catch (err) {
        console.warn('Could not auto-register voice note object:', err);
      }
    }

    const payload: Task = {
      id: taskId,
      title: title.trim(),
      description: description.trim(),
      customerId: customerId || undefined,
      customerName: selectedCust?.name || undefined,
      assignedUserId: assignedUserId || currentUser.id,
      assignedUserName: selectedUser?.name || currentUser.name,
      sharedWithUserIds: cleanedSharedIds,
      sharedWithUserNames: cleanedSharedNames,
      creatorUserId: taskToEdit?.creatorUserId || currentUser.id,
      creatorUserName: taskToEdit?.creatorUserName || currentUser.name,
      priority,
      status,
      dueDate: new Date(dueDate).toISOString(),
      completedAt: status === TaskStatus.COMPLETED ? new Date().toISOString() : undefined,
      voiceNoteAudioUrl: voiceNoteAudioUrl || undefined,
      voiceNoteDuration: voiceNoteDuration || undefined,
      voiceNoteTranscript: voiceNoteTranscript || undefined,
      voiceNoteId: linkedVoiceNoteId || undefined,
      createdAt: taskToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveTask(payload);
    storage.clearDraft(draftKey);
    setHasRestoredDraft(false);

    success(taskToEdit ? (isRtl ? 'وظیفه با موفقیت ویرایش شد' : 'Task updated successfully') : (isRtl ? 'وظیفه جدید با موفقیت ایجاد شد' : 'New task created successfully'));
    onSaved(saved);
    onClose();
  };

  const otherUsersForSharing = (allUsers || []).filter((u) => u.id !== assignedUserId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          <span>{taskToEdit ? (isRtl ? 'ویرایش وظیفه و اقدام' : 'Edit Task') : (isRtl ? 'تعریف وظیفه جدید' : 'New Task')}</span>
        </div>
      }
      subtitle={isRtl ? 'تخصیص مسئول، تعیین سطح اولویت، ضبط دستور صوتی و موعد سررسید' : 'Assign owner, set priority, record voice order, and due date'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {hasRestoredDraft && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-fadeIn">
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{isRtl ? 'پیش‌نویس ذخیره‌شده خودکار شما بازیابی گردید.' : 'Your auto-saved draft has been restored.'}</span>
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-amber-300 hover:text-white underline font-semibold px-2 py-1 rounded hover:bg-amber-500/20 transition-colors shrink-0"
            >
              پاک کردن پیش‌نویس
            </button>
          </div>
        )}

        <Input
          label={isRtl ? 'عنوان وظیفه / اقدام' : 'Task Title'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRtl ? 'مثال: ارسال پیش‌فاکتور رسمی و پیگیری واریز پیش‌پرداخت' : 'e.g. Send formal proforma and follow up deposit payment'}
          isRequired
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={isRtl ? 'مشتری مرتبط (اختیاری)' : 'Linked Customer (optional)'}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={[
              { value: '', label: isRtl ? 'بدون مشتری / کار داخلی سازمانی' : 'No customer / internal task' },
              ...(allCustomers || []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.mobile})`,
              })),
            ]}
          />

          <Select
            label={isRtl ? 'مسئول اصلی انجام (تخصیص به)' : 'Assign To'}
            value={assignedUserId}
            onChange={(e) => {
              const newId = e.target.value;
              setAssignedUserId(newId);
              setSharedWithUserIds((prev) => prev.filter((id) => id !== newId));
            }}
            isRequired
            options={(allUsers || []).map((u) => ({
              value: u.id,
              label: `${u.name} (${u.role})`,
            }))}
          />
        </div>

        {/* Shared with users */}
        {otherUsersForSharing.length > 0 && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{isRtl ? 'اشتراک‌گذاری با سایر همکاران (دسترسی مشاهده و انجام مشترک):' : 'Share with colleagues (view & joint completion):'}</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {sharedWithUserIds.length > 0 ? (isRtl ? `${sharedWithUserIds.length} نفر انتخاب شده` : `${sharedWithUserIds.length} selected`) : (isRtl ? 'اختیاری' : 'Optional')}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
              {(otherUsersForSharing || []).map((u) => {
                const isSelected = sharedWithUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggleShared(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all border ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/60 font-semibold shadow-xs'
                        : 'bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    <span>{u.name}</span>
                    <span className="text-[10px] text-slate-400">({u.role})</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              فقط مسئول اصلی، ایجادکننده (ادمین) و این همکاران منتخب قادر به دیدن و انجام این وظیفه خواهند بود.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={isRtl ? 'سطح اولویت وظیفه' : 'Task Priority'}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            options={[
              { value: TaskPriority.LOW, label: isRtl ? '🟢 اولویت پایین' : '🟢 Low' },
              { value: TaskPriority.MEDIUM, label: isRtl ? '🟡 اولویت متوسط' : '🟡 Medium' },
              { value: TaskPriority.HIGH, label: isRtl ? '🟠 اولویت بالا' : '🟠 High' },
              { value: TaskPriority.URGENT, label: isRtl ? '🔴 اضطراری و فوری' : '🔴 Urgent' },
            ]}
          />

          <Select
            label={isRtl ? 'وضعیت پیشرفت' : 'Progress Status'}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            options={[
              { value: TaskStatus.PENDING, label: isRtl ? '⏳ در انتظار انجام' : '⏳ Pending' },
              { value: TaskStatus.IN_PROGRESS, label: isRtl ? '🔄 در حال انجام' : '🔄 In Progress' },
              { value: TaskStatus.COMPLETED, label: isRtl ? '✅ تکمیل شده' : '✅ Completed' },
              { value: TaskStatus.CANCELLED, label: isRtl ? '❌ لغو شده' : '❌ Cancelled' },
            ]}
          />
        </div>

        {/* Due Date & Scheduling Section */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isRtl ? 'مهلت سررسید و زمان تحویل اقدام' : 'Due Date & Delivery Time'}</span>
              <span className="text-rose-500 dark:text-rose-400 font-bold">*</span>
            </span>

            {/* Quick date shortcuts */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setHours(18, 0, 0, 0);
                  setDueDate(d.toISOString().substring(0, 16));
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60 whitespace-nowrap"
              >
                امروز ۱۸:۰۰
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(12, 0, 0, 0);
                  setDueDate(d.toISOString().substring(0, 16));
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60 whitespace-nowrap"
              >
                فردا ۱۲:۰۰
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  d.setHours(10, 0, 0, 0);
                  setDueDate(d.toISOString().substring(0, 16));
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60 whitespace-nowrap"
              >
                هفته آینده
              </button>
            </div>
          </div>

          <JalaliDatePicker
            label={isRtl ? 'انتخاب دقیق تاریخ و ساعت سررسید' : 'Select Due Date & Time'}
            value={dueDate}
            onChange={(val) => setDueDate(val)}
            showTime
            includeTime
            isRequired
            placeholder={isRtl ? 'برای انتخاب تاریخ شمسی و ساعت کلیک کنید...' : 'Click to pick Jalali date & time...'}
          />
        </div>

        {/* VOICE NOTE & AUDIO INSTRUCTION FOR TASK */}
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-gradient-to-br dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-slate-950/80 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  یادداشت و دستور کار صوتی (Voice Note)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ضبط صدای توضیحات و راهنمای صوتی جهت ابلاغ مستقیم به مسئول وظیفه
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsVoiceSectionOpen(!isVoiceSectionOpen)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 hover:bg-indigo-200 dark:hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 transition-colors flex items-center gap-1.5"
            >
              {isVoiceSectionOpen ? (isRtl ? 'بستن پنل صوت' : 'Close Audio Panel') : voiceNoteAudioUrl ? (isRtl ? 'مشاهده/تغییر صوت' : 'View / Change Audio') : (isRtl ? '🎙️ ضبط یا افزودن صوت' : '🎙️ Record or Add Audio')}
            </button>
          </div>

          {/* If audio is already attached / recorded */}
          {voiceNoteAudioUrl && !isRecording && (
            <div className="p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-indigo-200 dark:border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isRtl ? 'فایل صوتی پیوست وظیفه' : 'Task Audio Attachment'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-[11px] flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'حذف صوت' : 'Remove Audio'}</span>
                </button>
              </div>

              <AudioPlayer src={voiceNoteAudioUrl} duration={voiceNoteDuration} />

              {voiceNoteTranscript && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">{isRtl ? 'متن پیاده‌سازی شده از' : 'Transcribed from'} صوت:</span>
                  {voiceNoteTranscript}
                </div>
              )}
            </div>
          )}

          {/* Active Voice Recorder Panel */}
          {isVoiceSectionOpen && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-xs mx-auto text-xs">
                <button
                  type="button"
                  onClick={() => setVoiceInputMode('RECORD')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    voiceInputMode === 'RECORD'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'ضبط مستقیم با میکروفون' : 'Record with Microphone'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceInputMode('UPLOAD')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    voiceInputMode === 'UPLOAD'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'آپلود فایل صوتی' : 'Upload Audio File'}</span>
                </button>
              </div>

              {voiceInputMode === 'RECORD' ? (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 text-center space-y-3">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-400">{isRtl ? 'وضعیت:' : 'Status:'}</span>
                      {isRequestingPermission ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          درخواست دسترسی از مرورگر...
                        </span>
                      ) : isRecording ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          {isPaused ? (isRtl ? 'مکث ضبط' : 'Paused') : (isRtl ? 'در حال ضبط زنده...' : 'Recording...')}
                        </span>
                      ) : recorderStatus === 'permission_denied' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-medium">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          دسترسی مسدود شد
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">{isRtl ? 'آماده ضبط' : 'Ready to record'}</span>
                      )}
                    </div>
                  </div>

                  {/* Browser Permission Prompt Banner */}
                  {isRequestingPermission && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-end text-xs text-amber-300 animate-fade-in flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                      <p className="text-[11px] text-amber-200">
                        {isRtl ? 'لطفاً در پیام بالای صفحه مرورگر روی دکمه' : 'In the browser popup at the top, click'}{' '}<strong>Allow</strong>{isRtl ? ' کلیک کنید.' : '.'}
                      </p>
                    </div>
                  )}

                  {/* Error & Instructions Card if Permission Denied */}
                  {errorInfo && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-end text-xs text-rose-200 space-y-2 animate-fade-in">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold text-rose-200">{errorInfo.message}</p>
                          {errorInfo.instructions && errorInfo.instructions.length > 0 && (
                            <ul className="text-[10px] text-rose-300/90 list-disc list-inside space-y-0.5">
                              {errorInfo.instructions.slice(0, 2).map((inst, i) => (
                                <li key={i}>{inst}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {errorInfo.canRetry && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={retryPermission}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{isRtl ? 'تلاش مجدد و فعال‌سازی میکروفون' : 'Retry & Enable Microphone'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visualizer & Timer */}
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="text-2xl font-black font-mono tracking-wider tabular-nums text-slate-900 dark:text-slate-100">
                      {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:
                      {(recordingDuration % 60).toString().padStart(2, '0')}
                    </div>

                    {isRecording ? (
                      <div className="flex items-center gap-1 h-8 px-4 py-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        {audioLevels.map((lvl, idx) => (
                          <div
                            key={idx}
                            className="w-1.5 bg-gradient-to-t from-indigo-500 to-rose-500 rounded-full transition-all duration-75"
                            style={{ height: `${Math.max(15, lvl * 100)}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        روی دکمه ضبط کلیک کنید و دستورات یا توضیحات وظیفه را بگویید
                      </p>
                    )}
                  </div>

                  {/* Recorder Controls */}
                  <div className="flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={handleStartTaskVoiceRecording}
                        disabled={isRequestingPermission}
                        className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-transform active:scale-95"
                      >
                        <Mic className="w-4 h-4" />
                        <span>{isRequestingPermission ? (isRtl ? 'در حال درخواست مجوز...' : 'Requesting permission...') : (isRtl ? 'شروع ضبط صوت' : 'Start Recording')}</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handlePauseToggleRecording}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700"
                        >
                          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          <span>{isPaused ? (isRtl ? 'ادامه' : 'Resume') : (isRtl ? 'توقف موقت' : 'Pause')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleStopTaskVoiceRecording}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-transform active:scale-95"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>{isRtl ? 'تکمیل و ثبت صوت' : 'Finish & Save Audio'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelVoiceRecording}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 transition-colors"
                          title={isRtl ? 'لغو ضبط' : 'Cancel recording'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500/60 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all cursor-pointer text-center space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm,.opus"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProcessAudioFile(file);
                    }}
                  />
                  <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    برای انتخاب یا کشیدن فایل صوتی اینجا کلیک کنید
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    پشتیبانی از فرمت‌های MP3, M4A, WAV, OGG, WebM (حداکثر ۲۵ مگابایت)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Textarea
          label={isRtl ? 'توضیحات و جزئیات تکمیلی وظیفه' : 'Notes & Details'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={isRtl ? 'دستورالعمل متنی، نیازمندی‌ها یا فایل‌های مورد نیاز...' : 'Instructions, requirements or needed files...'}
          actionButton={
            <VoiceInputButton
              onTranscript={(transcript) => {
                setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
            />
          }
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {taskToEdit ? (isRtl ? 'ذخیره تغییرات وظیفه' : 'Save Task Changes') : (isRtl ? 'ایجاد وظیفه' : 'Create Task')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

