import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CheckItem, CheckType, CheckStatus, Customer } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { CreditCard, Check, DollarSign, Calendar } from 'lucide-react';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface CheckFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkToEdit?: CheckItem | null;
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  onSaved: (check: CheckItem) => void;
}

export const CheckFormModal: React.FC<CheckFormModalProps> = ({
  isOpen,
  onClose,
  checkToEdit,
  initialCustomer,
  allCustomers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatCurrency } = useTranslation();

  const [type, setType] = useState<CheckType>(CheckType.RECEIVED);
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadNumber, setSayadNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState<CheckStatus>(CheckStatus.IN_SAFE);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (checkToEdit) {
      setType(checkToEdit.type || CheckType.RECEIVED);
      setCheckNumber(checkToEdit.checkNumber || '');
      setSayadNumber(checkToEdit.sayadNumber || '');
      setBankName(checkToEdit.bankName || '');
      setBranchName(checkToEdit.branchName || '');
      setAmount(String(checkToEdit.amount || ''));
      setDueDate(checkToEdit.dueDate ? checkToEdit.dueDate.substring(0, 10) : '');
      setIssuerName(checkToEdit.issuerName || '');
      setCustomerId(checkToEdit.customerId || '');
      setStatus(checkToEdit.status || CheckStatus.IN_SAFE);
      setNotes(checkToEdit.notes || '');
    } else {
      setType(CheckType.RECEIVED);
      setCheckNumber('');
      setSayadNumber('');
      setBankName(isRtl ? 'بانک ملت' : 'Mellat Bank');
      setBranchName('');
      setAmount('');
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      setDueDate(defaultDue.toISOString().substring(0, 10));
      setCustomerId(initialCustomer?.id || (allCustomers[0]?.id || ''));
      setIssuerName(initialCustomer?.name || '');
      setStatus(CheckStatus.IN_SAFE);
      setNotes('');
    }
  }, [checkToEdit, initialCustomer, allCustomers, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount.replace(/,/g, ''));
    if (!numAmount || numAmount <= 0) {
      error(isRtl ? 'لطفاً مبلغ چک را به درستی وارد کنید' : 'Please enter a valid amount');
      return;
    }
    if (!checkNumber.trim()) {
      error(isRtl ? 'لطفاً شماره سریال چک را وارد کنید' : 'Please enter check number');
      return;
    }
    if (!dueDate) {
      error(isRtl ? 'لطفاً تاریخ سررسید چک را وارد کنید' : 'Please select due date');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);

    const payload: CheckItem = {
      id: checkToEdit?.id || '',
      type,
      checkNumber: checkNumber.trim(),
      sayadNumber: sayadNumber.trim() || undefined,
      bankName: bankName.trim(),
      branchName: branchName.trim() || undefined,
      amount: numAmount,
      dueDate: new Date(dueDate).toISOString(),
      issuerName: issuerName.trim() || selectedCust?.name || '',
      customerId: customerId || undefined,
      customerName: selectedCust?.name || undefined,
      status,
      notes: notes.trim() || undefined,
      createdAt: checkToEdit?.createdAt || '',
      updatedAt: '',
    };

    const saved = storage.saveCheck(payload);
    success(checkToEdit ? (isRtl ? 'اطلاعات چک ویرایش شد' : 'Check updated') : (isRtl ? 'چک جدید در خزانه‌داری ثبت شد' : 'Check registered'));
    onSaved(saved);
    onClose();
  };

  const rawAmount = Number(amount.replace(/,/g, '')) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <span>{checkToEdit ? (isRtl ? 'ویرایش سند چک' : 'Edit Check') : t('checks.newCheckBtn')}</span>
        </div>
      }
      subtitle={t('checks.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Select
            label={t('checks.type')}
            value={type}
            onChange={(e) => setType(e.target.value as CheckType)}
            options={[
              { value: CheckType.RECEIVED, label: t('checks.typeReceived') },
              { value: CheckType.PAID, label: t('checks.typePaid') },
            ]}
          />

          <Select
            label={t('checks.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as CheckStatus)}
            options={[
              { value: CheckStatus.IN_SAFE, label: t('checks.statusInSafe') },
              { value: CheckStatus.DEPOSITED, label: t('checks.statusDeposited') },
              { value: CheckStatus.CLEARED, label: t('checks.statusCleared') },
              { value: CheckStatus.BOUNCED, label: t('checks.statusBounced') },
              { value: CheckStatus.TRANSFERRED, label: t('checks.statusTransferred') },
              { value: CheckStatus.RETURNED, label: isRtl ? 'مسترد شده به صادرکننده' : 'Returned' },
            ]}
          />

          <Select
            label={t('checks.customer')}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              const cust = (allCustomers || []).find((c) => c.id === e.target.value);
              if (cust && !issuerName) setIssuerName(cust.name);
            }}
            options={[
              { value: '', label: isRtl ? 'بدون مشتری' : 'No customer' },
              ...(allCustomers || []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.mobile})`,
              })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <Input
              label={t('checks.amount')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="150000000"
              isRequired
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
            />
            {rawAmount > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-start pe-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawAmount)}
              </p>
            )}
          </div>

          <JalaliDatePicker
            label={t('checks.dueDate')}
            value={dueDate}
            onChange={(val) => setDueDate(val)}
            isRequired
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label={t('checks.checkNumber')}
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="78912345"
            isRequired
          />

          <Input
            label={t('checks.sayadNumber')}
            value={sayadNumber}
            onChange={(e) => setSayadNumber(e.target.value)}
            placeholder="1402948192837465"
          />

          <Input
            label={t('checks.issuerName')}
            value={issuerName}
            onChange={(e) => setIssuerName(e.target.value)}
            placeholder={isRtl ? 'نام شخص یا شرکت' : 'Person or Company Name'}
            isRequired
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label={t('checks.bank')}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={isRtl ? 'مثال: بانک ملت، تجارت، سامان...' : 'e.g. Mellat, Tejarat...'}
            isRequired
          />

          <Input
            label={t('checks.branch')}
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder={isRtl ? 'مثال: شعبه مرکزی کد ۱۲۰۴' : 'e.g. Central Branch 1204'}
          />
        </div>

        <Textarea
          label={t('checks.description')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={isRtl ? 'شرح چک، شماره فاکتور تسویه شده، یا مشخصات ضامن...' : 'Check notes, invoice reference, guarantor info...'}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {checkToEdit ? t('common.save') : t('checks.newCheckBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
