import React, { Suspense, lazy } from 'react';
import { Attachment } from '../../types';

// Lazy load the heavy AttachmentPreviewModal (includes motion/react, many icons)
const AttachmentPreviewModal = lazy(() => import('./AttachmentPreviewModal').then(m => ({ default: m.AttachmentPreviewModal })));

export interface FilePreviewModalProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
  attachmentsList?: Attachment[];
  onNavigate?: (attachment: Attachment) => void;
}

/**
 * FilePreviewModal: Centralized preview modal forwarding to AttachmentPreviewModal.
 * Provides zoom (wheel/pinch), pan, in-app PDF viewing, fullscreen, and metadata.
 * Lazy-loaded to reduce initial bundle size.
 */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = (props) => {
  return (
    <Suspense fallback={null}>
      <AttachmentPreviewModal {...props} />
    </Suspense>
  );
};
