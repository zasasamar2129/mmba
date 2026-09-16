import React, { useState, useMemo } from 'react';
import { Attachment } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTranslation } from '../../lib/i18n';
import { Search, FileText, Paperclip, Check } from 'lucide-react';

export interface AttachDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: Attachment[];
  onSelectAttachment: (attachment: Attachment) => void;
}

export const AttachDocumentModal: React.FC<AttachDocumentModalProps> = ({
  isOpen,
  onClose,
  attachments = [],
  onSelectAttachment,
}) => {
  const { isRtl } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (attachments || []).filter((a) => {
      if (!q) return true;
      return (a.fileName || '').toLowerCase().includes(q) || (a.fileType || '').toLowerCase().includes(q);
    });
  }, [attachments, query]);

  const selectedAttachment = attachments.find((a) => a.id === selectedId);

  const handleConfirm = () => {
    if (selectedAttachment) {
      onSelectAttachment(selectedAttachment);
      setSelectedId(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isRtl ? 'پیوست سند به پیام' : 'Attach Document to Message'}
      subtitle={isRtl ? 'انتخاب از اسناد و فایل‌های سیستم' : 'Select from system documents and files'}
    >
      <div className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isRtl ? 'جستجو در نام اسناد...' : 'Search document name...'}
          rightIcon={<Search className="w-4 h-4 text-slate-400" />}
        />

        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {isRtl ? 'سندی برای انتخاب یافت نشد.' : 'No documents available.'}
            </div>
          ) : (
            filtered.map((att) => {
              const isSelected = att.id === selectedId;
              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setSelectedId(att.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{att.fileName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(att.fileSize ? (att.fileSize / 1024).toFixed(1) + ' KB' : '')} • {att.fileType || 'file'}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedId}
            leftIcon={<Paperclip className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'پیوست به پیام' : 'Attach'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
