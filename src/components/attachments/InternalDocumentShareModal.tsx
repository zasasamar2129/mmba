import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { Attachment, Customer, User } from '../../types';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { Share2, Users, FileText, Send, Check, Sparkles } from 'lucide-react';

export interface InternalDocumentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Attachment | null;
  onShared?: () => void;
}

export const InternalDocumentShareModal: React.FC<InternalDocumentShareModalProps> = ({
  isOpen,
  onClose,
  document,
  onShared,
}) => {
  const { success, error, warning } = useToast();
  const { isRtl } = useTranslation();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(document?.customerId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = storage.getCurrentUser();
  const allUsers = storage.getUsers().filter((u) => u.id !== currentUser.id && u.isActive !== false);
  const allCustomers = storage.getCustomers();

  if (!document) return null;

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === allUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(allUsers.map((u) => u.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      warning(isRtl ? 'لطفاً حداقل یک کاربر گیرنده را انتخاب کنید.' : 'Please select at least one recipient user.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCustomer = selectedCustomerId ? allCustomers.find((c) => c.id === selectedCustomerId) : undefined;
      const recipientUsers = selectedUserIds.map((id) => {
        const u = allUsers.find((user) => user.id === id);
        return { id, name: u?.name || (isRtl ? 'کاربر' : 'User') };
      });

      await storage.shareDocument({
        documentId: document.id,
        documentFileName: document.fileName,
        documentFileType: document.fileType,
        documentFileSize: document.fileSize,
        recipientUsers,
        message: message.trim() || undefined,
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomer?.name,
      });

      success(isRtl ? `سند «${document.fileName}» برای ${selectedUserIds.length} کاربر با موفقیت ارسال شد.` : `Document "${document.fileName}" sent to ${selectedUserIds.length} user(s) successfully.`);
      setSelectedUserIds([]);
      setMessage('');
      if (onShared) onShared();
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در اشتراک‌گذاری سند' : 'Error sharing document'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'اشتراک‌گذاری سند با همکاران داخلی' : 'Share document with internal colleagues'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-end">
        {/* Document Info Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {document.fileName}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{document.fileType || (isRtl ? 'سند' : 'Document')}</span>
              {document.customerName && (
                <>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{isRtl ? 'مشتری:' : 'Customer:'} {document.customerName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Customer Link (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {isRtl ? 'اتصال به مشتری (اختیاری):' : 'Link to customer (optional):'}
          </label>
          <Select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">{isRtl ? 'بدون اتصال به مشتری (سند درون‌سازمانی مستقل)' : 'No customer link (standalone internal document)'}</option>
            {allCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.mobile})
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-slate-500 mt-1">
            {isRtl ? 'اسناد می‌توانند بدون اتصال به مشتری یا متصل به یک پرونده مشخص به اشتراک گذاشته شوند.' : 'Documents can be shared without a customer link or attached to a specific customer record.'}
          </p>
        </div>

        {/* Select Recipients */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRtl ? `انتخاب همکاران گیرنده (${selectedUserIds.length} نفر):` : `Select recipient colleagues (${selectedUserIds.length} people):`}
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              {selectedUserIds.length === allUsers.length
                ? (isRtl ? 'لغو انتخاب همه' : 'Deselect all')
                : (isRtl ? 'انتخاب همه همکاران' : 'Select all colleagues')}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1.5 bg-white dark:bg-slate-900">
            {allUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                      {u.name.substring(0, 1)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</div>
                      <div className="text-[10px] text-slate-500">{u.role}</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent onClick
                    className="rounded text-indigo-600"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Note / Message */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {isRtl ? 'پیام یا یادداشت برای گیرندگان (اختیاری):' : 'Message or note for recipients (optional):'}
          </label>
          <Input
            placeholder={isRtl ? 'مثال: رسید واریز مشتری برای بررسی و تأیید پرونده...' : 'e.g. Customer payment receipt for review and file approval...'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={selectedUserIds.length === 0}
            leftIcon={<Send className="w-4 h-4" />}
          >
            {isRtl ? 'ارسال و اشتراک‌گذاری سند' : 'Send & Share Document'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
