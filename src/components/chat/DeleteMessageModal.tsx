import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslation } from '../../lib/i18n';
import { Trash2, AlertTriangle } from 'lucide-react';

export interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { isRtl } = useTranslation();
  const [reason, setReason] = useState('ارسال اشتباه');
  const [customReason, setCustomReason] = useState('');

  const commonReasons = [
    { key: 'ارسال اشتباه', label: isRtl ? 'ارسال اشتباه یا پیام تکراری' : 'Sent by mistake / duplicate' },
    { key: 'اطلاعات نادرست', label: isRtl ? 'اطلاعات نادرست یا ناقص' : 'Incorrect / incomplete info' },
    { key: 'اطلاعات محرمانه', label: isRtl ? 'حاوی اطلاعات حساس یا محرمانه' : 'Contains sensitive information' },
    { key: 'OTHER', label: isRtl ? 'سایر موارد...' : 'Other...' },
  ];

  const handleConfirm = () => {
    const finalReason = reason === 'OTHER' ? (customReason.trim() || 'سایر دلایل') : reason;
    onConfirm(finalReason);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={isRtl ? 'حذف پیام گفتگو' : 'Delete Message'}
      subtitle={isRtl ? 'ثبت دلیل حذف در لاگ حسابرسی سامانه' : 'Record deletion reason in audit log'}
    >
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5 text-amber-800 dark:amber-200 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isRtl
              ? 'این پیام برای تمام اعضای گفتگو حذف خواهد شد، اما ردپا و زمان حذف برای بازرسی در سیستم ثبت می‌گردد.'
              : 'This message will be marked as deleted for all members, and the deletion reason will be logged for audit.'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            {isRtl ? 'علت حذف پیام را انتخاب نمایید:' : 'Select deletion reason:'}
          </label>
          <div className="space-y-1.5">
            {commonReasons.map((r) => (
              <label
                key={r.key}
                className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
              >
                <input
                  type="radio"
                  name="deletion_reason"
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-800 dark:text-slate-200 font-medium">{r.label}</span>
              </label>
            ))}
          </div>

          {reason === 'OTHER' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={isRtl ? 'علت حذف را بنویسید...' : 'Type reason...'}
              className="mt-2 w-full text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'حذف پیام' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
