import React, { useState } from 'react';
import {
  Eye,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Calendar,
  User,
  ExternalLink,
  Share2,
  PenLine,
  History,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Attachment } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import {
  detectFileInfo,
  formatFileSize,
  getAttachmentSrc,
  downloadAttachment,
  createThumbnail,
} from '../../lib/filePreviewUtils';

export interface AttachmentItemProps {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
  onDelete?: (id: string) => void;
  onLinkCustomer?: (attachment: Attachment) => void;
  onShare?: (attachment: Attachment) => void;
  onRename?: (attachment: Attachment) => void;
  onShowAudit?: (attachment: Attachment) => void;
  canDelete?: boolean;
  viewMode?: 'card' | 'row';
}

export const AttachmentItem: React.FC<AttachmentItemProps> = ({
  attachment,
  onPreview,
  onDelete,
  onLinkCustomer,
  onShare,
  onRename,
  onShowAudit,
  canDelete = true,
  viewMode = 'card',
}) => {
  const { t, isRtl } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const info = detectFileInfo(attachment);
  const fileName = attachment.displayName || attachment.fileName || (attachment as any).filename || 'file';
  const src = attachment.thumbnailDataUrl || attachment.dataUrl;
  const previewSrc = src || getAttachmentSrc(attachment);
  const sizeText = formatFileSize(attachment.fileSize);

  // Generate thumbnail for HEIC files on mount
  React.useEffect(() => {
    if (info.isImage && previewSrc && (previewSrc.includes('image/heic') || previewSrc.includes('image/heif'))) {
      createThumbnail(previewSrc).then(setThumbnailSrc);
    }
  }, [previewSrc, info.isImage]);

  if (viewMode === 'row') {
    return (
      <div
        id={`attachment-row-${attachment.id}`}
        className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all gap-3 group shadow-xs"
      >
        {/* Left: Thumbnail / Icon + Name + Meta */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={() => onPreview(attachment)}
        >
          {/* Thumbnail / Icon Box */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {info.isImage && (thumbnailSrc || previewSrc) && !imgError ? (
              <img
                src={thumbnailSrc || previewSrc}
                alt={fileName}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : info.isPdf ? (
              <FileText className="w-6 h-6 text-rose-500" />
            ) : info.isSpreadsheet ? (
              <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
            ) : info.isDocument ? (
              <FileText className="w-6 h-6 text-blue-500" />
            ) : info.isArchive ? (
              <FileArchive className="w-6 h-6 text-amber-500" />
            ) : (
              <FileIcon className="w-6 h-6 text-slate-400" />
            )}
            <span
              className={`absolute bottom-0 inset-x-0 text-[9px] font-bold text-center py-0.5 leading-none bg-slate-950/70 text-white truncate`}
            >
              {info.displayType}
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 text-end">
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
              title={fileName}
            >
              {fileName}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{info.displayType}</span>
              <span>•</span>
              <span>{sizeText}</span>
              {attachment.createdAt && (
                <>
                  <span>•</span>
                  <span>{formatPersianDate(attachment.createdAt, false)}</span>
                </>
              )}
              {attachment.customerName && (
                <>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-sans font-medium truncate max-w-[140px]">
                    {attachment.customerName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Preview, Download, Delete) */}
        <div className="flex items-center gap-1 shrink-0">
          {onRename && (
            <button
              type="button"
              onClick={() => onRename(attachment)}
              title={isRtl ? 'تغییر نام نمایشی سند' : 'Rename document display name'}
              className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
            >
              <PenLine className="w-4 h-4" />
            </button>
          )}
          {onShowAudit && (
            <button
              type="button"
              onClick={() => onShowAudit(attachment)}
              title={isRtl ? 'تاریخچه عملیات سند (Audit Log)' : 'Document activity history (Audit Log)'}
              className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            id={`btn-preview-${attachment.id}`}
            onClick={() => onPreview(attachment)}
            title={t('documents.preview')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/60 text-xs font-bold transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isRtl ? 'پیش‌نمایش' : 'Preview'}</span>
          </button>

          {onShare && (
            <button
              type="button"
              id={`btn-share-${attachment.id}`}
              onClick={() => onShare(attachment)}
              title={isRtl ? 'اشتراک‌گذاری سند با پرسنل و همکاران' : 'Share document with staff and colleagues'}
              className="p-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            id={`btn-download-${attachment.id}`}
            onClick={() => downloadAttachment(attachment)}
            title={t('documents.download')}
            className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {canDelete && onDelete && (
            <button
              type="button"
              id={`btn-delete-${attachment.id}`}
              onClick={() => {
                if (window.confirm(t('documents.deleteConfirm'))) {
                  onDelete(attachment.id);
                }
              }}
              title={isRtl ? 'حذف پیوست' : 'Delete attachment'}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card View (Default gallery grid card matching Requirement 4)
  return (
    <div
      id={`attachment-card-${attachment.id}`}
      className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all overflow-hidden shadow-xs hover:shadow-md group"
    >
      {/* Top Preview / Thumbnail Area */}
      <div
        className="relative h-40 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => onPreview(attachment)}
      >
        {info.isImage && (thumbnailSrc || previewSrc) && !imgError ? (
          <img
            src={thumbnailSrc || previewSrc}
            alt={fileName}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            {info.isPdf && <FileText className="w-12 h-12 text-rose-500" />}
            {info.isSpreadsheet && <FileSpreadsheet className="w-12 h-12 text-emerald-500" />}
            {info.isDocument && <FileText className="w-12 h-12 text-blue-500" />}
            {info.isArchive && <FileArchive className="w-12 h-12 text-amber-500" />}
            {!info.isPdf && !info.isSpreadsheet && !info.isDocument && !info.isArchive && (
              <FileIcon className="w-12 h-12 text-slate-400" />
            )}
            <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">
              {info.displayType}
            </span>
          </div>
        )}

        {/* Hover Overlay with Preview Icon */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 text-xs font-bold shadow-lg">
            <Eye className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isRtl ? 'پیش‌نمایش سریع' : 'Quick preview'}</span>
          </span>
        </div>

        {/* Top Floating Badges */}
        <div className="absolute top-2 start-2 flex items-center gap-1 z-10">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shadow-xs ${info.colorClass}`}
          >
            {info.displayType}
          </span>
        </div>

        <div className="absolute top-2 end-2 z-10">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-900/80 text-white backdrop-blur-sm shadow-xs">
            {sizeText}
          </span>
        </div>

        {attachment.uploadStatus === 'PROCESSING' && (
          <div className="absolute bottom-2 start-2 z-10">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/90 text-white backdrop-blur-sm shadow-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {isRtl ? 'در حال پردازش' : 'Processing'}
            </span>
          </div>
        )}
      </div>

      {/* Card Body & Metadata */}
      <div className="p-3.5 space-y-2.5 text-end flex-1 flex flex-col justify-between">
        <div>
          <h4
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate cursor-pointer group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
            title={fileName}
            onClick={() => onPreview(attachment)}
          >
            {fileName}
          </h4>

          <div className="space-y-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {attachment.createdAt && (
              <div className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{formatPersianDate(attachment.createdAt, false)}</span>
              </div>
            )}
            {attachment.customerName && (
              <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 truncate">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{attachment.customerName}</span>
              </div>
            )}
            {attachment.sha256 && (
              <div
                className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 truncate"
                title={`SHA-256: ${attachment.sha256}`}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">{attachment.sha256.slice(0, 16)}…</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onPreview(attachment)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isRtl ? 'پیش‌نمایش' : 'Preview'}</span>
          </button>

          {onRename && (
            <button
              type="button"
              onClick={() => onRename(attachment)}
              title={isRtl ? 'تغییر نام نمایشی سند' : 'Rename document display name'}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
            >
              <PenLine className="w-4 h-4" />
            </button>
          )}

          {onShowAudit && (
            <button
              type="button"
              onClick={() => onShowAudit(attachment)}
              title={isRtl ? 'تاریخچه عملیات سند (Audit Log)' : 'Document activity history (Audit Log)'}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {onShare && (
            <button
              type="button"
              id={`btn-card-share-${attachment.id}`}
              onClick={() => onShare(attachment)}
              title={isRtl ? 'اشتراک‌گذاری سند با پرسنل و همکاران' : 'Share document with staff and colleagues'}
              className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => downloadAttachment(attachment)}
            title={t('documents.download')}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('documents.deleteConfirm'))) {
                  onDelete(attachment.id);
                }
              }}
              title={isRtl ? 'حذف پیوست' : 'Delete attachment'}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
