import React from 'react';
import { Attachment } from '../../types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

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
 */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = (props) => {
  return <AttachmentPreviewModal {...props} />;
};
