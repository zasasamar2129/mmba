import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Payment, PaymentType, Customer, Attachment } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { DollarSign, Check, CreditCard, Receipt, Paperclip } from 'lucide-react';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  initialPayment?: Payment | null;
  allCustomers: Customer[];
  onSaved: (payment: Payment) => void;
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  isOpen,
  onClose,
  initialCustomer,
  initialPayment,
  allCustomers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatCurrency } = useTranslation();

  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (initialPayment) {
      setCustomerId(initialPayment.customerId || '');
      setAmount(initialPayment.amount ? String(initialPayment.amount) : '');
      setPaymentType((initialPayment.paymentType as PaymentType) || PaymentType.BANK_TRANSFER);
      setPaymentDate(initialPayment.paymentDate || initialPayment.date || new Date().toISOString().substring(0, 10));
      setReferenceNumber(initialPayment.referenceNumber || '');
      setDescription(initialPayment.description || initialPayment.notes || '');
      
      // Load existing attachments
      const existingAtts = storage.getAttachmentsByEntity('PAYMENT', initialPayment.id);
      if (existingAtts.length > 0) {
        setAttachments(existingAtts);
      } else if (initialPayment.attachmentIds && initialPayment.attachmentIds.length > 0) {
        const allAtts = storage.getAttachments();
        const matched = allAtts.filter((a) => initialPayment.attachmentIds?.includes(a.id));
        setAttachments(matched);
      } else {
        setAttachments([]);
      }
    } else {
      if (initialCustomer) {
        setCustomerId(initialCustomer.id);
      } else if (allCustomers.length > 0) {
        setCustomerId(allCustomers[0].id);
      }
      setPaymentDate(new Date().toISOString().substring(0, 10));
      setAmount('');
      setPaymentType(PaymentType.BANK_TRANSFER);
      setReferenceNumber('');
      setDescription('');
      setAttachments([]);
    }
  }, [initialCustomer, initialPayment, allCustomers, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount.replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      error(isRtl ? 'لطفاً مبلغ معتبر واریزی را وارد کنید' : 'Please enter a valid amount');
      return;
    }
    if (!customerId) {
      error(isRtl ? 'لطفاً مشتری را انتخاب کنید' : 'Please select a customer');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);
    const paymentId = initialPayment?.id || `pay-${Date.now()}`;

    // Save and link all attachments
    const savedAttachmentIds: string[] = [];
    attachments.forEach((att) => {
      const attToSave: Attachment = {
        ...att,
        customerId,
        customerName: selectedCust?.name || '',
        relatedEntityType: 'PAYMENT',
        relatedEntityId: paymentId,
      };
      const savedAtt = storage.saveAttachment(attToSave);
      savedAttachmentIds.push(savedAtt.id);
    });

    const payload: Payment = {
      id: paymentId,
      customerId,
      customerName: selectedCust?.name || '',
      amount: numAmount,
      paymentType,
      paymentDate: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      referenceNumber: referenceNumber.trim() || undefined,
      description: description.trim() || undefined,
      notes: description.trim() || undefined,
      attachmentIds: savedAttachmentIds,
      recordedByUserId: initialPayment?.recordedByUserId || storage.getCurrentUser().id,
      recordedByUserName: initialPayment?.recordedByUserName || storage.getCurrentUser().name,
      createdAt: initialPayment?.createdAt || '',
    };

    const saved = storage.savePayment(payload);
    success(isRtl ? `واریزی به مبلغ ${formatCurrency(numAmount)} با موفقیت ثبت شد` : `Payment of ${formatCurrency(numAmount)} recorded successfully`);
    onSaved(saved);
    onClose();
  };

  const rawAmount = Number(amount.replace(/,/g, '')) || 0;
  const currentSelectedCustomer = allCustomers.find((c) => c.id === customerId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {initialPayment ? (isRtl ? 'ویرایش سند دریافت وجه / واریزی' : 'Edit Payment') : t('payments.newPaymentBtn')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('payments.subtitle')}
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={t('payments.customer')}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          isRequired
          options={(allCustomers || []).map((c) => ({
            value: c.id,
            label: `${c.name} (${c.mobile})${c.companyName ? ` - ${c.companyName}` : ''}`,
          }))}
        />

        <div className="space-y-1">
          <Input
            label={t('payments.amount')}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50000000"
            isRequired
            leftIcon={<DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
          />
          {rawAmount > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-left pr-2">
              {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawAmount)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={t('payments.paymentMethod')}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
            options={[
              { value: PaymentType.BANK_TRANSFER, label: t('payments.methodBankTransfer') },
              { value: PaymentType.POS, label: t('payments.methodPos') },
              { value: PaymentType.CASH, label: t('payments.methodCash') },
              { value: PaymentType.ONLINE_GATEWAY, label: t('payments.methodGateway') },
              { value: PaymentType.OTHER, label: isRtl ? 'سایر روش‌ها' : 'Other' },
            ]}
          />

          <JalaliDatePicker
            label={t('payments.paymentDate')}
            value={paymentDate}
            onChange={(isoVal) => setPaymentDate(isoVal)}
            isRequired
          />
        </div>

        <Input
          label={t('payments.referenceNumber')}
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="948274102938"
        />

        <Textarea
          label={t('payments.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={isRtl ? 'بابت تسویه فاکتور سیم‌کارت‌های رند یا پیش‌پرداخت قرارداد...' : 'For invoice settlement, advance payment...'}
        />

        {/* Attachments Section */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <AttachmentUploader
            attachments={attachments}
            onChange={setAttachments}
            customerId={customerId}
            customerName={currentSelectedCustomer?.name}
            relatedEntityType="PAYMENT"
            uploaderName={storage.getCurrentUser().name}
            uploaderId={storage.getCurrentUser().id}
            title={isRtl ? 'ضمیمه و اسکن فیش واریزی / رسید کارتخوان' : 'Attach Receipt / Transfer Slip'}
            subtitle={isRtl ? 'می‌توانید عکس فیش (JPG, PNG, WebP) یا فایل‌های متنی/PDF تاییدیه بانکی را اینجا پیوست کنید' : 'Upload slip image or PDF confirmation'}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {initialPayment ? t('common.save') : t('payments.newPaymentBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

