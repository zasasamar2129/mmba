import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Customer, DateSuggestion } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';

export interface CustomerDateSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onSaved?: (suggestion: DateSuggestion) => void;
}

export const CustomerDateSuggestionModal: React.FC<CustomerDateSuggestionModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSaved,
}) => {
  const { isRtl } = useTranslation();
  const { success, error } = useToast();
  const [title, setTitle] = useState(isRtl ? 'جلسه هماهنگی / تحویل حضوری' : 'Coordination / In-person Delivery Meeting');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [alternativeDate, setAlternativeDate] = useState('');
  const [confirmedDate, setConfirmedDate] = useState('');
  const [status, setStatus] = useState<'CUSTOMER_SUGGESTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED'>('CUSTOMER_SUGGESTED');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedDate) {
      error(isRtl ? 'لطفاً تاریخ پیشنهادی اولیه را وارد نمایید' : 'Please enter the initial suggested date');
      return;
    }

    const item = storage.saveDateSuggestion({
      id: '',
      customerId: customer.id,
      title,
      suggestedDate,
      alternativeDate: alternativeDate || undefined,
      confirmedDate: confirmedDate || undefined,
      status,
      notes: notes || undefined,
      createdAt: '',
    });

    success(isRtl ? 'پیشنهاد و زمان‌بندی تاریخ با موفقیت ثبت شد' : 'Date suggestion scheduled successfully');
    onSaved?.(item);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <span>{isRtl ? 'پیشنهاد و تثبیت تاریخ جلسه/قرار با مشتری' : 'Suggest & Confirm Customer Meeting Date'}</span>
        </div>
      }
      subtitle={`${isRtl ? 'مشتری: ' : 'Customer: '}${customer.name} (${customer.mobile})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={isRtl ? 'عنوان جلسه / هماهنگی' : 'Meeting / Coordination Title'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          isRequired
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <JalaliDatePicker
            label={isRtl ? 'تاریخ پیشنهادی مشتری / اولیه (شمسی)' : 'Customer / Initial Suggested Date (Solar)'}
            value={suggestedDate}
            onChange={(val) => setSuggestedDate(val)}
            showTime
            isRequired
          />
          <JalaliDatePicker
            label={isRtl ? 'تاریخ جایگزین / ثانویه (اختیاری)' : 'Alternative / Secondary Date (Optional)'}
            value={alternativeDate}
            onChange={(val) => setAlternativeDate(val)}
            showTime
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={isRtl ? 'وضعیت توافق زمان' : 'Time Agreement Status'}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'CUSTOMER_SUGGESTED', label: isRtl ? 'پیشنهاد شده توسط مشتری' : 'Suggested by Customer' },
              { value: 'UNDER_REVIEW', label: isRtl ? 'در حال بررسی توسط کارشناس' : 'Under Specialist Review' },
              { value: 'CONFIRMED', label: isRtl ? 'تایید و قطعی شده' : 'Confirmed & Finalized' },
              { value: 'REJECTED', label: isRtl ? 'رد شده / نیازمند زمان جدید' : 'Rejected / Needs Rescheduling' },
            ]}
          />
          <JalaliDatePicker
            label={isRtl ? 'تاریخ نهایی و تایید شده (شمسی)' : 'Final Confirmed Date (Solar)'}
            value={confirmedDate}
            onChange={(val) => setConfirmedDate(val)}
            showTime
            disabled={status !== 'CONFIRMED'}
          />
        </div>

        <Textarea
          label={isRtl ? 'توضیحات و هماهنگی‌ها' : 'Notes & Coordination'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isRtl ? 'نکات هماهنگی با مشتری یا لوکیشن جلسه...' : 'Customer coordination notes or meeting location...'}
        />

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            {isRtl ? 'ثبت زمان‌بندی' : 'Save Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
