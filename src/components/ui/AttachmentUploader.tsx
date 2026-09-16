import React, { useState, useRef } from 'react';
import { Attachment } from '../../types';
import {
  Upload, Paperclip, Image as ImageIcon, FileText,
  Trash2, Eye, Download, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { useToast } from './Toast';
import { FilePreviewModal } from './FilePreviewModal';
import { formatPersianDate } from '../../lib/dateUtils';

export interface AttachmentUploaderProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  readOnly?: boolean;
  category?: string;
  customerId?: string;
  customerName?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  uploaderName?: string;
  uploaderId?: string;
  title?: string;
  subtitle?: string;
}

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'csv'
];

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  attachments = [],
  onChange,
  maxFiles = 10,
  maxSizeMB = 10,
  disabled = false,
  readOnly = false,
  category = 'فیش واریزی / سند مالی',
  customerId,
  customerName,
  relatedEntityType = 'PAYMENT',
  relatedEntityId,
  uploaderName = 'کاربر سیستم',
  uploaderId = 'usr-current',
  title = 'ضمیمه و پیوست اسناد / فیش واریزی',
  subtitle = 'پشتیبانی از عکس فیش (JPG, PNG, WebP, HEIC/HEIF) و اسناد متنی/PDF تا سقف ۱۰ مگابایت',
}) => {
  const { success, error, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'نامشخص';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndProcessFile = (file: File): Promise<Attachment | null> => {
    return new Promise((resolve) => {
      // 1. Extension check
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        error(`پسوند .${ext} پشتیبانی نمی‌شود. فقط فرمت‌های تصویر (JPG, PNG, WebP, HEIC/HEIF) و اسناد (PDF, Word, Excel, Text) مجاز هستند.`);
        resolve(null);
        return;
      }

      // 2. Size check
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        error(`حجم فایل "${file.name}" (${formatFileSize(file.size)}) بیش از سقف مجاز ${maxSizeMB} مگابایت است.`);
        resolve(null);
        return;
      }

      // 3. Read data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        // Determine correct MIME type - mobile browsers often report empty or wrong types for HEIC/HEIF
        // ALWAYS override based on extension for known image formats
        const mimeMap: Record<string, string> = {
          'heic': 'image/heic',
          'heif': 'image/heif',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'webp': 'image/webp',
          'pdf': 'application/pdf',
          'txt': 'text/plain',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'csv': 'text/csv',
        };
        // Use extension-based MIME for images/docs, fall back to file.type only for unknown
        const fileType = mimeMap[ext] || file.type || `application/${ext}`;

        // Fix the data URL header to use the correct MIME type
        // Browser's FileReader may embed wrong MIME (e.g. application/json for HEIC)
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

        const newAttachment: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          filename: file.name,
          fileType: fileType,
          mimeType: fileType,
          fileSize: file.size,
          sizeBytes: file.size,
          dataUrl: fixedDataUrl,
          category: fileType.startsWith('image/') ? 'تصویر فیش واریزی' : 'سند و مدرک مالی',
          customerId: customerId || '',
          customerName: customerName || '',
          relatedEntityType,
          relatedEntityId: relatedEntityId || '',
          uploadedByUserId: uploaderId,
          uploadedByUserName: uploaderName,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        resolve(newAttachment);
      };

      reader.onerror = () => {
        error(`خطا در پردازش فایل "${file.name}"`);
        resolve(null);
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > maxFiles) {
      warning(`حداکثر می‌توانید تا ${maxFiles} فایل ضمیمه نمایید.`);
      return;
    }

    setIsProcessing(true);
    const addedList: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await validateAndProcessFile(file);
      if (processed) {
        addedList.push(processed);
      }
    }

    if (addedList.length > 0) {
      onChange([...attachments, ...addedList]);
      success(`${addedList.length} فایل با موفقیت ضمیمه شد`);
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = attachments.filter((a) => a.id !== id);
    onChange(updated);
  };

  const handleDownload = (att: Attachment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const link = document.createElement('a');
    link.href = att.dataUrl || att.url || '#';
    link.download = att.fileName || att.filename || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 text-right">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {attachments.length > 0 && (
          <Badge variant="indigo" size="sm">
            {attachments.length} پیوست
          </Badge>
        )}
      </div>

      {/* Upload Zone (hidden in readOnly) */}
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            if (!disabled && !isProcessing && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
              : isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[0.99]'
              : 'border-slate-300 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,image/*,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || isProcessing}
            className="hidden"
          />

          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            <Upload className="w-5 h-5 animate-bounce-subtle" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isProcessing
                ? 'در حال پردازش و ضمیمه فایل...'
                : 'برای انتخاب یا بارگذاری فایل اینجا کلیک کنید یا فایل را بکشید و رها کنید'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              فرمت‌های مجاز: عکس فیش (JPG, PNG, WebP, HEIC/HEIF)، تصویر کارتخوان، اسکن قرارداد، PDF و فایل‌های متنی (حداکثر {maxSizeMB}MB)
            </p>
          </div>
        </div>
      )}

      {/* Attachment List / Cards */}
      {attachments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map((att) => {
            const fileName = att.fileName || att.filename || 'سند';
            const fileType = att.fileType || att.mimeType || '';
            const isImg = fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(fileName);
            const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={att.id}
                onClick={() => setPreviewAttachment(att)}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-xs"
              >
                {/* Thumbnail / Icon */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {isImg && att.dataUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                      <img
                        src={att.dataUrl}
                        alt={fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center border ${
                      isPdf
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                        : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                  )}

                  <div className="truncate text-right">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" title={fileName}>
                      {fileName}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatFileSize(att.fileSize || att.sizeBytes)} • {isImg ? 'عکس فیش' : isPdf ? 'سند PDF' : 'فایل متنی'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewAttachment(att);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                    title="پیش‌نمایش سند"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownload(att, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                    title="دانلود فایل"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(att.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="حذف پیوست"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : readOnly ? (
        <p className="text-xs text-slate-500 italic text-right py-2">
          هیچ فیش یا سندی به این تراکنش پیوست نشده است.
        </p>
      ) : null}

      {/* Lightbox / Preview Modal */}
      <FilePreviewModal
        attachment={previewAttachment}
        isOpen={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};
