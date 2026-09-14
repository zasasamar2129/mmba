import React, { useState } from 'react';
import { Attachment } from '../../types';
import { Eye, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { AttachmentPreviewModal } from '../ui/AttachmentPreviewModal';
import { AttachmentItem } from './AttachmentItem';
import { detectFileInfo, formatFileSize, getAttachmentSrc, downloadAttachment } from '../../lib/filePreviewUtils';

export interface AttachmentPreviewProps {
  attachment: Attachment;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
  onDelete?: (id: string) => void;
}

/**
 * Reusable AttachmentPreview Component for MMBA.
 * Can be dropped into any card, table, or detail view to provide
 * an instant thumbnail preview, file info, and one-click lightbox preview.
 */
export const AttachmentPreview: React.FC<AttachmentPreviewProps> & {
  List: React.FC<{
    attachments: Attachment[];
    onDelete?: (id: string) => void;
    viewMode?: 'grid' | 'row' | 'chips';
    emptyMessage?: string;
  }>;
} = ({ attachment, size = 'md', showDetails = true, className = '', onDelete }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const info = detectFileInfo(attachment);
  const fileName = attachment.fileName || (attachment as any).filename || 'file';
  const previewSrc = getAttachmentSrc(attachment);

  if (size === 'sm') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsPreviewOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all text-xs group max-w-[200px] ${className}`}
          title={fileName}
        >
          {info.isImage && previewSrc ? (
            <img
              src={previewSrc}
              alt={fileName}
              loading="lazy"
              className="w-5 h-5 rounded object-cover shrink-0 border border-slate-300 dark:border-slate-600"
            />
          ) : (
            <div className="p-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="truncate text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {fileName}
          </span>
          <Eye className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0" />
        </button>

        <AttachmentPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          attachment={attachment}
        />
      </>
    );
  }

  return (
    <>
      <AttachmentItem
        attachment={attachment}
        onPreview={() => setIsPreviewOpen(true)}
        onDelete={onDelete}
        viewMode={size === 'lg' ? 'card' : 'row'}
      />

      <AttachmentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        attachment={attachment}
      />
    </>
  );
};

/**
 * Sub-component for rendering a list or gallery of attachments
 */
AttachmentPreview.List = function AttachmentPreviewList({
  attachments,
  onDelete,
  viewMode = 'grid',
  emptyMessage = 'هیچ پیوستی وجود ندارد',
}) {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  if (viewMode === 'chips') {
    return (
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <AttachmentPreview
            key={att.id}
            attachment={att}
            size="sm"
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        }
      >
        {attachments.map((att) => (
          <AttachmentItem
            key={att.id}
            attachment={att}
            onPreview={(a) => setSelectedAttachment(a)}
            onDelete={onDelete}
            viewMode={viewMode === 'grid' ? 'card' : 'row'}
          />
        ))}
      </div>

      <AttachmentPreviewModal
        isOpen={Boolean(selectedAttachment)}
        onClose={() => setSelectedAttachment(null)}
        attachment={selectedAttachment}
        attachmentsList={attachments}
        onNavigate={(next) => setSelectedAttachment(next)}
      />
    </>
  );
};
