import React, { useState, useEffect, useMemo } from 'react';
import { VoiceNote, VoiceNoteCategory, NoteType, Customer, User } from '../../types';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { FileText, Check } from 'lucide-react';

export interface TextNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer;
  allCustomers: Customer[];
  note?: VoiceNote | null;
  onSaved: (note: VoiceNote) => void;
}

export const TextNoteModal: React.FC<TextNoteModalProps> = ({
  isOpen,
  onClose,
  initialCustomer,
  allCustomers = [],
  note,
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState<VoiceNoteCategory | string>(VoiceNoteCategory.GENERAL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!note;

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && note) {
      setTitle(note.title || '');
      setBody(note.body || note.transcription || '');
      setCustomerId(note.customerId || '');
      setCategory(note.category || VoiceNoteCategory.GENERAL);
    } else {
      setTitle('');
      setBody('');
      setCustomerId(initialCustomer?.id || '');
      setCategory(VoiceNoteCategory.GENERAL);
    }
  }, [isOpen, isEdit, note, initialCustomer]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!body.trim()) {
      error(isRtl ? 'لطفاً متن یادداشت را وارد کنید.' : 'Please enter a note body.');
      return;
    }
    setIsSubmitting(true);
    try {
      const customer = (allCustomers || []).find((c) => c.id === customerId);
      const currentUser = storage.getCurrentUser();
      const payload: Partial<VoiceNote> & { noteType?: NoteType | string; audioDataUrl?: string } = {
        id: note?.id,
        noteType: NoteType.TEXT,
        title: title.trim() || (isEdit ? note?.title || (isRtl ? 'یادداشت متنی' : 'Text Note') : (isRtl ? 'یادداشت متنی جدید' : 'New Text Note')),
        body: body.trim(),
        customerId: customerId || undefined,
        customerName: customer?.name,
        audioDataUrl: undefined,
        durationSeconds: 0,
        category: category as VoiceNoteCategory,
        createdById: isEdit ? (note?.createdById || currentUser.id) : currentUser.id,
        createdByName: isEdit ? (note?.createdByName || currentUser.name) : currentUser.name,
        createdAt: isEdit ? (note?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        relatedEntityType: customerId ? 'CUSTOMER' : 'GENERAL',
        relatedEntityId: customerId || undefined,
      };
      const saved = storage.saveVoiceNote(payload);
      success(isEdit
        ? (isRtl ? 'یادداشت متنی با موفقیت ویرایش شد.' : 'Text note updated successfully.')
        : (isRtl ? 'یادداشت متنی جدید ثبت شد.' : 'New text note created.'));
      onSaved(saved);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ذخیره یادداشت' : 'Failed to save note'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          <span>{isEdit ? (isRtl ? 'ویرایش یادداشت متنی' : 'Edit Text Note') : (isRtl ? 'یادداشت متنی جدید' : 'New Text Note')}</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={isRtl ? 'عنوان' : 'Title'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRtl ? 'مثال: پیگیری با مشتری احمدی' : 'e.g. Follow up with Mr. Ahmad'}
        />

        <Textarea
          label={isRtl ? 'متن یادداشت' : 'Note Body'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isRtl ? 'مشتری گفت تا دو روز آینده برای خرید تصمیم می‌گیرد...' : 'Customer said they will decide on purchase within two days...'}
          isRequired
          rows={5}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label={isRtl ? 'مرتبط با مشتری' : 'Linked Customer'}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">{isRtl ? 'بدون پیوند' : 'No link'}</option>
            {(allCustomers || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.phone || c.mobile || ''})</option>
            ))}
          </Select>

          <Select
            label={isRtl ? 'دسته‌بندی' : 'Category'}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value={VoiceNoteCategory.GENERAL}>{isRtl ? 'عمومی' : 'General'}</option>
            <option value={VoiceNoteCategory.INTERNAL_MEMO}>{isRtl ? 'یادداشت درون‌سازمانی' : 'Internal Memo'}</option>
            <option value={VoiceNoteCategory.CALL_MEMO}>{isRtl ? 'شرح مذاکره' : 'Call Memo'}</option>
            <option value={VoiceNoteCategory.TASK_INSTRUCTION}>{isRtl ? 'دستور کار' : 'Task Instruction'}</option>
            <option value={VoiceNoteCategory.PAYMENT_APPROVAL}>{isRtl ? 'دستور پرداخت' : 'Payment Approval'}</option>
          </Select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            {isEdit
              ? (isRtl ? `نویسنده: ${note?.createdByName || '---'}` : `Author: ${note?.createdByName || '---'}`)
              : (isRtl ? `نویسنده: ${storage.getCurrentUser().name}` : `Author: ${storage.getCurrentUser().name}`)}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting} leftIcon={<Check className="w-4 h-4" />}>
              {isEdit ? (isRtl ? 'ذخیره تغییرات' : 'Save Changes') : (isRtl ? 'ثبت یادداشت' : 'Create Note')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};