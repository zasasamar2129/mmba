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
  const { success, error } = useToast();
  const [title, setTitle] = useState('جلسه هماهنگی / تحویل حضوری');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [alternativeDate, setAlternativeDate] = useState('');
  const [confirmedDate, setConfirmedDate] = useState('');
  const [status, setStatus] = useState<'CUSTOMER_SUGGESTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED'>('CUSTOMER_SUGGESTED');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedDate) {
      error('لطفاً تاریخ پیشنهادی اولیه را وارد نمایید');
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

    success('پیشنهاد و زمان‌بندی تاریخ با موفقیت ثبت شد');
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
          <span>پیشنهاد و تثبیت تاریخ جلسه/قرار با مشتری</span>
        </div>
      }
      subtitle={`مشتری: ${customer.name} (${customer.mobile})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="عنوان جلسه / هماهنگی"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          isRequired
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <JalaliDatePicker
            label="تاریخ پیشنهادی مشتری / اولیه (شمسی)"
            value={suggestedDate}
            onChange={(val) => setSuggestedDate(val)}
            showTime
            isRequired
          />
          <JalaliDatePicker
            label="تاریخ جایگزین / ثانویه (اختیاری)"
            value={alternativeDate}
            onChange={(val) => setAlternativeDate(val)}
            showTime
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="وضعیت توافق زمان"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'CUSTOMER_SUGGESTED', label: 'پیشنهاد شده توسط مشتری' },
              { value: 'UNDER_REVIEW', label: 'در حال بررسی توسط کارشناس' },
              { value: 'CONFIRMED', label: 'تایید و قطعی شده' },
              { value: 'REJECTED', label: 'رد شده / نیازمند زمان جدید' },
            ]}
          />
          <JalaliDatePicker
            label="تاریخ نهایی و تایید شده (شمسی)"
            value={confirmedDate}
            onChange={(val) => setConfirmedDate(val)}
            showTime
            disabled={status !== 'CONFIRMED'}
          />
        </div>

        <Textarea
          label="توضیحات و هماهنگی‌ها"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="نکات هماهنگی با مشتری یا لوکیشن جلسه..."
        />

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            ثبت زمان‌بندی
          </Button>
        </div>
      </form>
    </Modal>
  );
};
