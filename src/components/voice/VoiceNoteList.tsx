import React, { useState } from 'react';
import { VoiceNote, VoiceNoteCategory, NoteType, Customer, User } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { AudioPlayer } from '../ui/AudioPlayer';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import {
  Mic, Search, Filter, Plus, Clock, User as UserIcon, Building,
  Copy, Trash2, Check, Sparkles, Tag, FileAudio, ExternalLink, Pin, Upload, FileText, Pencil,
  LayoutGrid, List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface VoiceNoteListProps {
  voiceNotes: VoiceNote[];
  customers: Customer[];
  currentUser: User;
  onOpenNewVoiceNote: (mode?: 'RECORD' | 'UPLOAD') => void;
  onOpenNewTextNote: () => void;
  onEditNote: (note: VoiceNote) => void;
  onSelectCustomer: (customerId: string) => void;
  onDeleteVoiceNote: (id: string) => void;
}

export const VoiceNoteList: React.FC<VoiceNoteListProps> = ({
  voiceNotes = [],
  customers = [],
  currentUser,
  onOpenNewVoiceNote,
  onOpenNewTextNote,
  onEditNote,
  onSelectCustomer,
  onDeleteVoiceNote,
}) => {
  const { language, t, isRtl } = useTranslation();
  const { success } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getCategoryLabel = (cat: string) => {
    if (language === 'en') {
      switch (cat) {
        case VoiceNoteCategory.CUSTOMER_NOTE:
          return 'Customer Note';
        case VoiceNoteCategory.CALL_MEMO:
          return 'Call Memo';
        case VoiceNoteCategory.TASK_INSTRUCTION:
          return 'Task Instruction';
        case VoiceNoteCategory.REPAIR_DIAGNOSIS:
          return 'Repair Diagnosis';
        case VoiceNoteCategory.PAYMENT_APPROVAL:
          return 'Payment Approval';
        case VoiceNoteCategory.INTERNAL_MEMO:
          return 'Internal Memo';
        default:
          return 'General Note';
      }
    }
    switch (cat) {
      case VoiceNoteCategory.CUSTOMER_NOTE:
        return 'یادداشت مشتری';
      case VoiceNoteCategory.CALL_MEMO:
        return 'مذاکره تلفنی';
      case VoiceNoteCategory.TASK_INSTRUCTION:
        return 'دستور وظیفه';
      case VoiceNoteCategory.REPAIR_DIAGNOSIS:
        return 'عیب‌یابی تعمیرات';
      case VoiceNoteCategory.PAYMENT_APPROVAL:
        return 'تاییدیه مالی';
      case VoiceNoteCategory.INTERNAL_MEMO:
        return 'یادداشت سازمانی';
      default:
        return 'یادداشت عمومی';
    }
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case VoiceNoteCategory.CUSTOMER_NOTE:
        return 'primary' as const;
      case VoiceNoteCategory.CALL_MEMO:
        return 'info' as const;
      case VoiceNoteCategory.TASK_INSTRUCTION:
        return 'emerald' as const;
      case VoiceNoteCategory.REPAIR_DIAGNOSIS:
        return 'warning' as const;
      case VoiceNoteCategory.PAYMENT_APPROVAL:
        return 'purple' as const;
      default:
        return 'default' as const;
    }
  };

  // Filter list
  const filteredNotes = (voiceNotes || []).filter((vn) => {
    const matchSearch =
      !searchTerm ||
      vn.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vn.body && vn.body.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vn.customerName && vn.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vn.transcription && vn.transcription.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vn.tags && vn.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchCategory = categoryFilter === 'ALL' || vn.category === categoryFilter;
    const matchCustomer = customerFilter === 'ALL' || vn.customerId === customerFilter;

    return matchSearch && matchCategory && matchCustomer;
  });

  const handleCopyTranscript = (id: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    success(language === 'fa' ? 'متن یادداشت صوتی کپی شد' : 'Voice note transcript copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalDurationSeconds = (voiceNotes || []).reduce((sum, n) => sum + (n.durationSeconds || 0), 0);
  const totalMinutes = Math.round(totalDurationSeconds / 60);

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      if (language === 'en') {
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date);
      }
      return new Intl.DateTimeFormat('fa-IR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Top Banner Stats */}
      <div className="p-5 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 p-0.5 shadow-lg shadow-rose-500/20 flex items-center justify-center shrink-0">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {language === 'fa' ? 'یادداشت‌های صوتی و مکالمات' : 'Voice Notes & Audio Memos'}
              </h1>
              <Badge variant="rose" size="sm">
                {voiceNotes.length} {language === 'fa' ? 'صوت' : 'notes'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fa'
                ? 'آرشیو کامل مکالمات ضبط شده، آپلود فایل‌های صوتی جلسات و دستور کارهای پیوست به پرونده‌ها'
                : 'Complete archive of recorded calls, uploaded audio files, and attached voice memos'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title={language === 'fa' ? 'نمایش کارت‌ها' : 'Grid view'}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title={language === 'fa' ? 'نمایش فهرستی' : 'List view'}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">
                {language === 'fa' ? 'مجموع زمان صوت' : 'Total Duration'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {totalMinutes > 0
                  ? `${totalMinutes} ${language === 'fa' ? 'دقیقه' : 'min'}`
                  : `${totalDurationSeconds} ${language === 'fa' ? 'ثانیه' : 'sec'}`}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">
                {language === 'fa' ? 'پرونده‌های صوتی' : 'Linked Records'}
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {new Set((voiceNotes || []).map((v) => v.customerId).filter(Boolean)).size} {language === 'fa' ? 'پرونده' : 'records'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenNewVoiceNote('UPLOAD')}
            leftIcon={<Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            className="border-indigo-200 dark:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-600/10 text-indigo-700 dark:text-indigo-200"
          >
            {language === 'fa' ? 'آپلود فایل صوتی' : 'Upload Audio File'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onOpenNewTextNote}
            leftIcon={<FileText className="w-4 h-4" />}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-indigo-600/25 font-bold"
          >
            {language === 'fa' ? 'یادداشت متنی' : 'New Text Note'}
          </Button>

          <Button
            variant="danger"
            size="md"
            onClick={() => onOpenNewVoiceNote('RECORD')}
            leftIcon={<Mic className="w-4 h-4" />}
            className="shadow-rose-600/30 font-bold"
          >
            {language === 'fa' ? 'ضبط یادداشت جدید' : 'Record New Note'}
          </Button>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 md:col-span-5">
          <Input
            placeholder={
              language === 'fa'
                ? 'جستجو در عنوان، نام مشتری، برچسب‌ها یا متن مکالمه...'
                : 'Search title, customer name, tags or transcript...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="sm:col-span-3 md:col-span-4">
          <Select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            options={[
              { value: 'ALL', label: language === 'fa' ? 'همه مشتریان و پرونده‌ها' : 'All Customers & Records' },
              ...(customers || []).map((c) => ({
                value: c.id,
                label: `${c.name}${c.companyName ? ` (${c.companyName})` : ''}`,
              })),
            ]}
          />
        </div>

        <div className="sm:col-span-3 md:col-span-3">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: language === 'fa' ? 'همه موضوعات و دسته‌ها' : 'All Categories' },
              { value: VoiceNoteCategory.CUSTOMER_NOTE, label: getCategoryLabel(VoiceNoteCategory.CUSTOMER_NOTE) },
              { value: VoiceNoteCategory.CALL_MEMO, label: getCategoryLabel(VoiceNoteCategory.CALL_MEMO) },
              { value: VoiceNoteCategory.TASK_INSTRUCTION, label: getCategoryLabel(VoiceNoteCategory.TASK_INSTRUCTION) },
              { value: VoiceNoteCategory.REPAIR_DIAGNOSIS, label: getCategoryLabel(VoiceNoteCategory.REPAIR_DIAGNOSIS) },
              { value: VoiceNoteCategory.PAYMENT_APPROVAL, label: getCategoryLabel(VoiceNoteCategory.PAYMENT_APPROVAL) },
              { value: VoiceNoteCategory.INTERNAL_MEMO, label: getCategoryLabel(VoiceNoteCategory.INTERNAL_MEMO) },
              { value: VoiceNoteCategory.GENERAL, label: getCategoryLabel(VoiceNoteCategory.GENERAL) },
            ]}
          />
        </div>
      </div>

      {/* Voice Notes Grid / List */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800/80 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <FileAudio className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {language === 'fa' ? 'هیچ یادداشت صوتی یافت نشد' : 'No Voice Notes Found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {language === 'fa'
                ? 'می‌توانید همین حالا مکالمات تلفنی یا جلسات حضوری را با دکمه ضبط ثبت کنید یا فایل صوتی بارگذاری نمایید.'
                : 'You can record voice memos, call recordings, or upload audio files anytime.'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewTextNote}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              {language === 'fa' ? 'ثبت یادداشت متنی' : 'New Text Note'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenNewVoiceNote('UPLOAD')}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              {language === 'fa' ? 'آپلود فایل صوتی' : 'Upload Audio'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onOpenNewVoiceNote('RECORD')}
              leftIcon={<Mic className="w-4 h-4" />}
            >
              {language === 'fa' ? 'شروع ضبط صدا' : 'Start Recording'}
            </Button>
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredNotes.map((note) => (
            <motion.div
              key={note.id}
              layout
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm dark:shadow-xl ${viewMode === 'list' ? 'flex-row items-center space-y-0 space-x-4' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                    (note.noteType || 'VOICE') === NoteType.TEXT
                      ? 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30'
                      : 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30'
                  }`}>
                    {(note.noteType || 'VOICE') === NoteType.TEXT ? <FileText className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{note.title}</h3>
                      {(note.noteType || 'VOICE') === NoteType.TEXT && (
                        <Badge variant="indigo" size="sm">{language === 'fa' ? 'متن' : 'Text'}</Badge>
                      )}
                      {note.isPinned && (
                        <span className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px]" title={language === 'fa' ? 'سنجاق شده' : 'Pinned'}>
                          <Pin className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {formatDate(note.createdAt)}
                      </span>
                      <span>•</span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        {language === 'fa' ? `توسط ${note.createdByName}` : `by ${note.createdByName}`}
                      </span>
                    </div>
                  </div>
                </div>

                <Badge variant={getCategoryBadgeVariant(note.category)} size="sm">
                  {getCategoryLabel(note.category)}
                </Badge>
              </div>

              {/* Customer Association */}
              {note.customerId && (
                <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                    <Building className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    <span className="font-semibold truncate">
                      {language === 'fa' ? 'پرونده:' : 'Record:'} {note.customerName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(note.customerId!)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0 font-medium"
                  >
                    <span>{language === 'fa' ? 'مشاهده پرونده' : 'View Record'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Audio Player Widget (VOICE) or Body (TEXT) */}
              {note.noteType === NoteType.TEXT ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/70">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {note.body || note.transcription || ''}
                  </p>
                </div>
              ) : (
                <div className="pt-1">
                  <AudioPlayer
                    src={note.audioDataUrl || ''}
                    duration={note.durationSeconds}
                    title={note.title}
                  />
                </div>
              )}

              {/* Transcription */}
              {note.transcription && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>{language === 'fa' ? 'متن پیاده‌شده:' : 'Transcription:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyTranscript(note.id, note.transcription)}
                      className="hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      {copiedId === note.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {language === 'fa' ? 'کپی شد' : 'Copied'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{language === 'fa' ? 'کپی متن' : 'Copy Text'}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-24 overflow-y-auto pe-1">
                    {note.transcription}
                  </p>
                </div>
              )}

              {/* Footer: Tags & Delete */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-1 flex-wrap">
                  {note.tags && note.tags.length > 0 ? (
                    note.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-700 dark:text-slate-300 font-medium"
                      >
                        #{t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {language === 'fa' ? 'بدون برچسب' : 'No tags'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  {(currentUser.id === note.createdById || currentUser.role === 'GOD' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'OWNER') && (
                    <button
                      type="button"
                      onClick={() => onEditNote(note)}
                      className="p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={language === 'fa' ? 'ویرایش یادداشت' : 'Edit note'}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteVoiceNote(note.id)}
                    className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title={language === 'fa' ? 'حذف یادداشت' : 'Delete note'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
