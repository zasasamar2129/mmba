import React, { useState, useEffect } from 'react';
import { Attachment } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useTranslation } from '../../lib/i18n';
import { PenLine } from 'lucide-react';

export interface RenameDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
  onRename: (attachment: Attachment, newDisplayName: string) => void;
}

export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  isOpen,
  onClose,
  attachment,
  onRename,
}) => {
  const { t, isRtl } = useTranslation();
  const [displayName, setDisplayName] = useState('');

  const originalName = attachment?.originalName || attachment?.fileName || (attachment as any)?.filename || '';

  useEffect(() => {
    if (isOpen && attachment) {
      setDisplayName(attachment.displayName || attachment.fileName || originalName);
    }
  }, [isOpen, attachment, originalName]);

  if (!isOpen || !attachment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    onRename(attachment, displayName.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-indigo-500" />
          <span>{t('attachments.rename')}</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">{t('attachments.originalName')}</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" dir="ltr" title={originalName}>
            {originalName}
          </p>
        </div>

        <Input
          label={t('attachments.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          isRequired
          placeholder={isRtl ? 'مثال: قرارداد نهایی فروش خط رند' : 'e.g. Final sale contract'}
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<PenLine className="w-4 h-4" />}>
            {isRtl ? 'ذخیره نام جدید' : 'Save new name'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};