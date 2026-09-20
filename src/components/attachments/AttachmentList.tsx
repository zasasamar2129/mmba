import React, { useState, useMemo, useRef } from 'react';
import { Attachment, Customer, AuditLog, User } from '../../types';
import {
  Paperclip, Search, Upload, FileText, Image as ImageIcon,
  File, Trash2, Download, ExternalLink, Calendar, HardDrive, AlertCircle, CheckCircle2,
  Link2, Unlink, UserPlus, Eye, LayoutGrid, List as ListIcon, Filter, PenLine, ShieldCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { RTLNumber } from '../ui/RTLNumber';
import { formatPersianDate } from '../../lib/dateUtils';
import { computeSHA256 } from '../../lib/fileUtils';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { AttachmentItem } from './AttachmentItem';
import { InternalDocumentShareModal } from './InternalDocumentShareModal';
import { RenameDocumentModal } from './RenameDocumentModal';
import { DocumentAuditLog } from './DocumentAuditLog';
import { detectFileInfo, createThumbnail } from '../../lib/filePreviewUtils';
import { ListViewControls } from '../ui/ListViewControls';

export interface AttachmentListProps {
  attachments: Attachment[];
  customers: Customer[];
  currentUser?: User;
  onRefresh: () => void;
  onSelectCustomer: (customerId: string) => void;
}

type FileFilterType = 'ALL' | 'IMAGE' | 'PDF' | 'DOCUMENT';

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments = [],
  customers = [],
  currentUser,
  onRefresh,
  onSelectCustomer,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilterType>('ALL');
  const [viewMode, setViewMode] = useState<'card' | 'row'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [isSelectHighlighted, setIsSelectHighlighted] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Per-file upload status (Patch 05)
  type UploadPhase = 'READING' | 'PROCESSING' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
  const [uploads, setUploads] = useState<{ key: string; fileName: string; fileSize: number; phase: UploadPhase; progress: number; error?: string }[]>([]);
  const patchUpload = (key: string, patch: Partial<{ phase: UploadPhase; progress: number; error?: string }>) =>
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  const isUploading = uploads.some((u) => !['SUCCESS', 'ERROR'].includes(u.phase));

  // Preview Modal State
  const [activePreviewAtt, setActivePreviewAtt] = useState<Attachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const [linkingAttachment, setLinkingAttachment] = useState<Attachment | null>(null);
  const [newTargetCustomerId, setNewTargetCustomerId] = useState<string>('');
  const [shareAttachment, setShareAttachment] = useState<Attachment | null>(null);
  const [renameAttachment, setRenameAttachment] = useState<Attachment | null>(null);
  const [auditAttachment, setAuditAttachment] = useState<Attachment | null>(null);

  // Filtering attachments by search query and type filter
  const filteredAttachments = useMemo(() => {
    return (attachments || []).filter((att) => {
      const info = detectFileInfo(att);

      // Type filtering
      if (fileFilter === 'IMAGE' && !info.isImage) return false;
      if (fileFilter === 'PDF' && !info.isPdf) return false;
      if (fileFilter === 'DOCUMENT' && (info.isImage || info.isPdf)) return false;

      // Search query filtering
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const cName = (att.customerName || '').toLowerCase();
      const fName = (att.fileName || (att as any).filename || '').toLowerCase();
      const cat = (att.category || '').toLowerCase();
      return fName.includes(q) || cName.includes(q) || cat.includes(q);
    });
  }, [attachments, searchQuery, fileFilter]);

  const totalPages = Math.ceil(filteredAttachments.length / pageSize) || 1;
  const paginatedAttachments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAttachments.slice(start, start + pageSize);
  }, [filteredAttachments, currentPage, pageSize]);

  const counts = useMemo(() => {
    let images = 0;
    let pdfs = 0;
    let docs = 0;
    (attachments || []).forEach((att) => {
      const info = detectFileInfo(att);
      if (info.isImage) images++;
      else if (info.isPdf) pdfs++;
      else docs++;
    });
    return { all: attachments.length, images, pdfs, docs };
  }, [attachments]);

  const processAndSaveFile = (file: File, customerId?: string) => {
    const selectedCust = customerId ? customers.find((c) => c.id === customerId) : undefined;
    const key = `${customerId || 'general'}::${file.name}::${file.size}::${file.lastModified || 0}`;

    // In-flight duplicate guard
    if (uploads.some((u) => u.key === key && !['SUCCESS', 'ERROR'].includes(u.phase))) {
      return;
    }

    setUploads((prev) => [...prev, { key, fileName: file.name, fileSize: file.size, phase: 'READING', progress: 0 }]);
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.round((e.loaded / e.total) * 100);
        patchUpload(key, { progress: pct });
      }
    };
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      // Compute SHA-256 checksum for file integrity (Patch 04 - Security)
      const sha256 = await computeSHA256(dataUrl);

      // Duplicate detection by hash
      const existing = (attachments || []).find((a) => a.sha256 && a.sha256 === sha256);
      if (existing) {
        patchUpload(key, { phase: 'ERROR', error: 'فایل تکراری' });
        return;
      }

      // Determine correct MIME from extension - mobile browsers report
      // wrong/empty types for PNG and HEIC (e.g. application/json, empty string)
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        'heic': 'image/heic',
        'heif': 'image/heif',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
      };
      const fileType = mimeMap[ext] || file.type || 'application/octet-stream';

      // Rewrite the data URL header with the correct MIME so canvas/server
      // decode it properly (browser may embed wrong type for mobile uploads)
      let fixedDataUrl = dataUrl;
      if (dataUrl.startsWith('data:')) {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx > 5) {
          const headerPart = dataUrl.substring(5, commaIdx);
          const browserMime = headerPart.split(';')[0];
          if (browserMime && browserMime !== fileType) {
            fixedDataUrl = `data:${fileType}${headerPart.substring(browserMime.length)}${dataUrl.substring(commaIdx)}`;
          }
        }
      }

      const selectedCust = customerId ? customers.find((c) => c.id === customerId) : undefined;
      const newAtt: Attachment = {
        id: '',
        fileName: file.name,
        displayName: file.name,
        originalName: file.name,
        fileType: fileType,
        mimeType: fileType,
        fileSize: file.size,
        dataUrl: fixedDataUrl,
        sha256,
        customerId: selectedCust?.id,
        customerName: selectedCust?.name,
        category: fileType.startsWith('image/')
          ? (isRtl ? 'تصویر و مدرک شناسایی' : 'Identity / Image')
          : (isRtl ? 'سند و قرارداد' : 'Document / Contract'),
        uploadedByUserId: storage.getCurrentUser().id,
        uploadedByUserName: storage.getCurrentUser().name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploadStatus: 'RECEIVED',
        idempotencyKey: key,
      };

      const saved = storage.saveAttachment(newAtt);
      // Audit log: UPLOAD
      storage.logDocumentAudit(
        saved.id,
        'UPLOAD',
        storage.getCurrentUser().id,
        storage.getCurrentUser().name,
        `بارگذاری سند «${file.name}»${selectedCust ? ` برای ${selectedCust.name}` : ' در بایگانی عمومی'}`
      );

      patchUpload(key, { phase: 'UPLOADING' });
      // Fire-and-forget: thumbnail generation + server sync
      createThumbnail(fixedDataUrl)
        .then((thumb) => storage.updateAttachmentThumbnail(saved.id, thumb))
        .catch(() => {});
      // ETag/ETag backfill already handled on server POST response

      patchUpload(key, { phase: 'SUCCESS' });
      success(isRtl ? 'سند با موفقیت دریافت شد' : 'Document received');
      onRefresh();
    };

    reader.onerror = () => {
      error(isRtl ? 'خطا در خواندن و بارگذاری فایل' : 'Error reading and uploading file');
      patchUpload(key, { phase: 'ERROR', error: 'خطا در خواندن فایل' });
    };

    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear input immediately so same file can be reselected
    e.target.value = '';

    if (!selectedCustomerId) {
      processAndSaveFile(file, undefined);
    } else {
      processAndSaveFile(file, selectedCustomerId);
    }
  };

  const handleSaveCustomerLink = () => {
    if (!linkingAttachment) return;
    const targetCust = newTargetCustomerId ? customers.find((c) => c.id === newTargetCustomerId) : undefined;
    storage.updateAttachmentCustomer(
      linkingAttachment.id,
      targetCust?.id,
      targetCust?.name
    );
    if (targetCust) {
      success(isRtl ? `سند به پرونده ${targetCust.name} متصل شد` : `Attachment linked to ${targetCust.name}`);
    } else {
      success(isRtl ? 'انتساب سند از مشتری لغو شد و به حالت عمومی درآمد' : 'Attachment unlinked from customer');
    }
    setLinkingAttachment(null);
    setNewTargetCustomerId('');
    onRefresh();
  };

  const handleTriggerUpload = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleCustomerSelectChange = (custId: string) => {
    setSelectedCustomerId(custId);
    setIsSelectHighlighted(false);

    if (pendingFile && custId) {
      processAndSaveFile(pendingFile, custId);
    }
  };

  const handleDelete = (id: string) => {
    const att = (attachments || []).find((a) => a.id === id);
    if (att) {
      storage.logDocumentAudit(
        id,
        'DELETE',
        storage.getCurrentUser().id,
        storage.getCurrentUser().name,
        `حذف سند «${att.displayName || att.fileName || att.originalName || ''}»`
      );
    }
    storage.deleteAttachment(id);
    success(isRtl ? 'پیوست حذف شد' : 'Attachment deleted');
    if (activePreviewAtt?.id === id) {
      setActivePreviewAtt(null);
    }
    onRefresh();
  };

  const handleRename = (att: Attachment, newDisplayName: string) => {
    storage.renameAttachment(att.id, newDisplayName, storage.getCurrentUser().id, storage.getCurrentUser().name);
    success(isRtl ? 'نام نمایشی سند با موفقیت تغییر کرد' : 'Document display name updated');
    setRenameAttachment(null);
    onRefresh();
  };

  const handleShareComplete = (att: Attachment) => {
    storage.logDocumentAudit(
      att.id,
      'SHARE',
      storage.getCurrentUser().id,
      storage.getCurrentUser().name,
      `اشتراک‌گذاری سند «${att.displayName || att.fileName}» برای همکاران`
    );
    onRefresh();
  };

  return (
    <div className="space-y-6 animate-blur-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t('attachments.title')}
            </h1>
            <Badge variant="indigo" size="sm">
              <RTLNumber value={filteredAttachments.length} type="count" suffix={isRtl ? 'سند' : 'files'} />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('attachments.subtitle')}
          </p>
        </div>

        {/* View Mode Toggle (Grid / List) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'card'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="نمای شبکه‌ای (کارت)"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">کارت‌ها</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('row')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'row'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="نمای سطری (لیست)"
          >
            <ListIcon className="w-4 h-4" />
            <span className="hidden sm:inline">سطری</span>
          </button>
        </div>
      </div>

      {/* Upload card */}
      <div className="p-4 sm:p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span>{t('attachments.uploadNew')}</span>
          </h2>
          {pendingFile && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {isRtl ? `فایل "${pendingFile.name}" آماده انتساب به مشتری است` : `File "${pendingFile.name}" ready for customer assignment`}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>{t('attachments.selectCustomer')}</span>
              {isSelectHighlighted && (
                <span className="text-[11px] text-amber-500 animate-pulse font-normal">
                  {isRtl ? '(انتخاب مشتری الزامی است)' : '(Customer required)'}
                </span>
              )}
            </label>
            <select
              ref={selectRef}
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelectChange(e.target.value)}
              className={`w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/90 border text-slate-900 dark:text-slate-100 focus:outline-none transition-all ${
                isSelectHighlighted
                  ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
              }`}
            >
              <option value="">{isRtl ? '-- مشتری را برای انتساب فایل انتخاب کنید --' : '-- Select Customer to Attach File --'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRtl ? 'انتخاب و آپلود فایل (تصویر، PDF، مدرک)' : 'Select and Upload File (Image, PDF, Doc)'}
            </label>
            <button
              type="button"
              onClick={handleTriggerUpload}
              disabled={isUploading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer transition-all border ${
                selectedCustomerId
                  ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 shadow-lg shadow-indigo-600/20 active:scale-[0.99]'
                  : 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-500/40 active:scale-[0.99]'
              } ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <Upload className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
              <span>
                {isUploading
                  ? (isRtl ? 'در حال پردازش و ذخیره فایل...' : 'Processing and uploading...')
                  : selectedCustomerId
                  ? (isRtl ? 'انتخاب فایل از حافظه دستگاه' : 'Choose File from Device')
                  : t('attachments.uploadNew')}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Per-file upload progress */}
        {uploads.length > 0 && (
          <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
            {uploads.map((u) => (
              <div key={u.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                  u.phase === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : u.phase === 'ERROR' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {u.phase === 'SUCCESS' ? (isRtl ? 'موفق' : 'Success')
                    : u.phase === 'ERROR' ? (isRtl ? 'خطا' : 'Error')
                    : u.phase === 'PROCESSING' ? (isRtl ? 'در حال پردازش' : 'Processing')
                    : (isRtl ? 'در حال آپلود' : 'Uploading')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{u.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${u.phase === 'ERROR' ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${u.phase === 'PROCESSING' ? 100 : u.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 w-8 text-end">{u.progress}%</span>
                  </div>
                  {u.error && <p className="text-[10px] text-rose-500 mt-0.5">{u.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFileFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              fileFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            همه ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFileFilter('IMAGE')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              fileFilter === 'IMAGE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>تصاویر ({counts.images})</span>
          </button>
          <button
            type="button"
            onClick={() => setFileFilter('PDF')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              fileFilter === 'PDF'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>فایل‌های PDF ({counts.pdfs})</span>
          </button>
          <button
            type="button"
            onClick={() => setFileFilter('DOCUMENT')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              fileFilter === 'DOCUMENT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <File className="w-3.5 h-3.5" />
            <span>سایر اسناد ({counts.docs})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('attachments.searchPlaceholder')}
            rightIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* ListViewControls */}
      <ListViewControls
        viewMode={viewMode === 'row' ? 'list' : 'card'}
        onViewModeChange={(mode) => setViewMode(mode === 'list' ? 'row' : 'card')}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredAttachments.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[12, 24, 48, 96]}
      />

      {/* Attachments Display Grid/List */}
      {filteredAttachments.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <Paperclip className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('attachments.noAttachments')}</h3>
          <p className="text-xs text-slate-500">
            {t('attachments.noAttachmentsDesc')}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'card'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-2.5'
          }
        >
          {paginatedAttachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              viewMode={viewMode}
              onPreview={(a) => setActivePreviewAtt(a)}
              onDelete={handleDelete}
              onShare={(a) => setShareAttachment(a)}
              onRename={(a) => setRenameAttachment(a)}
              onShowAudit={(a) => setAuditAttachment(a)}
              onLinkCustomer={(a) => {
                setLinkingAttachment(a);
                setNewTargetCustomerId(a.customerId || '');
              }}
            />
          ))}
        </div>
      )}

      {/* Internal Document Share Modal */}
      <InternalDocumentShareModal
        isOpen={Boolean(shareAttachment)}
        onClose={() => setShareAttachment(null)}
        document={shareAttachment}
        onShared={() => {
          if (shareAttachment) handleShareComplete(shareAttachment);
        }}
      />

      {/* Rename Display Name Modal */}
      <RenameDocumentModal
        isOpen={Boolean(renameAttachment)}
        onClose={() => setRenameAttachment(null)}
        attachment={renameAttachment}
        onRename={handleRename}
      />

      {/* Document Audit Trail Modal */}
      {auditAttachment && (
        <Modal
          isOpen={Boolean(auditAttachment)}
          onClose={() => setAuditAttachment(null)}
          size="md"
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>{t('attachments.auditTrail')}</span>
            </div>
          }
          subtitle={auditAttachment.displayName || auditAttachment.fileName}
        >
          <DocumentAuditLog
            auditLogs={storage.getAuditLogsForEntity('ATTACHMENT', auditAttachment.id)}
            documentName={auditAttachment.displayName || auditAttachment.fileName}
          />
        </Modal>
      )}

      {/* Master Lightbox / Fullscreen Preview Modal */}
      <FilePreviewModal
        isOpen={Boolean(activePreviewAtt)}
        onClose={() => setActivePreviewAtt(null)}
        attachment={activePreviewAtt}
        attachmentsList={filteredAttachments}
        onNavigate={(next) => setActivePreviewAtt(next)}
      />

      {/* Link / Re-link Customer Modal */}
      {linkingAttachment && (
        <Modal
          isOpen={!!linkingAttachment}
          onClose={() => setLinkingAttachment(null)}
          title={isRtl ? 'اتصال یا تغییر مشتری سند' : 'Link Attachment to Customer'}
        >
          <div className="space-y-4 text-end">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isRtl
                ? `برای سند "${linkingAttachment.fileName}"، مشتری هدف را تعیین نمایید:`
                : `Select target customer for "${linkingAttachment.fileName}":`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'انتخاب مشتری' : 'Select Customer'}
              </label>
              <select
                value={newTargetCustomerId}
                onChange={(e) => setNewTargetCustomerId(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">{isRtl ? '-- بدون انتساب (بایگانی عمومی اسناد) --' : '-- No customer (General document) --'}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setLinkingAttachment(null)}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveCustomerLink}>
                {isRtl ? 'ذخیره پیوند' : 'Save Link'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
