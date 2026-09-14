import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Contract, ContractType, ContractStatus, Customer } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { FileSignature, Check, Calendar, DollarSign } from 'lucide-react';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractToEdit?: Contract | null;
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  onSaved: (contract: Contract) => void;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({
  isOpen,
  onClose,
  contractToEdit,
  initialCustomer,
  allCustomers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatCurrency } = useTranslation();

  const [contractNumber, setContractNumber] = useState('');
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [contractType, setContractType] = useState<ContractType>(ContractType.SIM_SALE);
  const [status, setStatus] = useState<ContractStatus>(ContractStatus.DRAFT);
  const [totalAmount, setTotalAmount] = useState('');
  const [prePaymentAmount, setPrePaymentAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (contractToEdit) {
      setContractNumber(contractToEdit.contractNumber || '');
      setTitle(contractToEdit.title || '');
      setCustomerId(contractToEdit.customerId || '');
      setContractType(contractToEdit.contractType || ContractType.SIM_SALE);
      setStatus(contractToEdit.status || ContractStatus.DRAFT);
      setTotalAmount(String(contractToEdit.totalAmount || ''));
      setPrePaymentAmount(String(contractToEdit.prePaymentAmount || ''));
      setStartDate(contractToEdit.startDate ? contractToEdit.startDate.substring(0, 10) : '');
      setEndDate(contractToEdit.endDate ? contractToEdit.endDate.substring(0, 10) : '');
      setTerms(contractToEdit.terms || '');
      setNotes(contractToEdit.notes || '');
    } else {
      const now = new Date();
      setContractNumber(`CTR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
      setTitle('');
      setCustomerId(initialCustomer?.id || (allCustomers[0]?.id || ''));
      setContractType(ContractType.SIM_SALE);
      setStatus(ContractStatus.ACTIVE);
      setTotalAmount('');
      setPrePaymentAmount('');
      setStartDate(now.toISOString().substring(0, 10));
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setEndDate(nextYear.toISOString().substring(0, 10));
      setTerms(isRtl ? 'طرفین متعهد به رعایت مفاد قوانین جاری کشور و تحویل به‌موقع موضوع قرارداد می‌باشند.' : 'The parties agree to fulfill the terms and conditions outlined in this agreement.');
      setNotes('');
    }
  }, [contractToEdit, initialCustomer, allCustomers, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      error(isRtl ? 'لطفاً عنوان قرارداد را وارد کنید' : 'Please enter contract title');
      return;
    }
    if (!customerId) {
      error(isRtl ? 'لطفاً طرف دوم قرارداد (مشتری) را تعیین کنید' : 'Please select customer');
      return;
    }
    if (!startDate) {
      error(isRtl ? 'لطفاً تاریخ شروع را مشخص کنید' : 'Please select start date');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);
    const numTotal = Number(totalAmount.replace(/,/g, '')) || 0;
    const numPre = Number(prePaymentAmount.replace(/,/g, '')) || 0;

    const payload: Contract = {
      id: contractToEdit?.id || '',
      contractNumber: contractNumber.trim(),
      title: title.trim(),
      customerId,
      customerName: selectedCust?.name || '',
      contractType,
      status,
      totalAmount: numTotal,
      prePaymentAmount: numPre,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      terms: terms.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: contractToEdit?.createdAt || '',
      updatedAt: '',
    };

    const saved = storage.saveContract(payload);
    success(contractToEdit ? (isRtl ? 'قرارداد با موفقیت ویرایش شد' : 'Contract updated successfully') : (isRtl ? 'قرارداد جدید در سامانه ثبت شد' : 'Contract created successfully'));
    onSaved(saved);
    onClose();
  };

  const rawTotal = Number(totalAmount.replace(/,/g, '')) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          <span>{contractToEdit ? (isRtl ? 'ویرایش اطلاعات قرارداد' : 'Edit Contract') : t('contracts.newContractBtn')}</span>
        </div>
      }
      subtitle={t('contracts.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label={t('contracts.contractNumber')}
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            isRequired
            placeholder="CTR-1403-8921"
          />

          <Select
            label={t('contracts.contractType')}
            value={contractType}
            onChange={(e) => setContractType(e.target.value as ContractType)}
            options={[
              { value: ContractType.SIM_SALE, label: t('contracts.typeSimSale') },
              { value: ContractType.REPAIR_SERVICE, label: t('contracts.typeService') },
              { value: ContractType.INSTALLMENT, label: t('contracts.typeInstallment') },
              { value: ContractType.SUPPORT, label: t('contracts.typeSupply') },
              { value: ContractType.OTHER, label: t('contracts.typeOther') },
            ]}
          />

          <Select
            label={t('contracts.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as ContractStatus)}
            options={[
              { value: ContractStatus.ACTIVE, label: t('contracts.statusActive') },
              { value: ContractStatus.DRAFT, label: t('contracts.statusDraft') },
              { value: ContractStatus.PENDING_SIGNATURE, label: t('contracts.statusPendingSignature') },
              { value: ContractStatus.COMPLETED, label: t('contracts.statusCompleted') },
              { value: ContractStatus.TERMINATED, label: t('contracts.statusTerminated') },
            ]}
          />
        </div>

        <Input
          label={t('contracts.contractTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isRtl ? 'مثال: واگذاری ۳ حلقه سیم‌کارت ۰۹۱۲ رند طلایی همراه با گارانتی' : 'e.g. Agreement for SIM cards supply and warranty'}
          isRequired
        />

        <Select
          label={t('contracts.customer')}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          isRequired
          options={(allCustomers || []).map((c) => ({
            value: c.id,
            label: `${c.name} (${c.mobile})${c.companyName ? ` - ${c.companyName}` : ''}`,
          }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <Input
              label={t('contracts.totalAmount')}
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="450000000"
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
            />
            {rawTotal > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-left pr-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawTotal)}
              </p>
            )}
          </div>

          <Input
            label={t('contracts.prepayment')}
            type="number"
            value={prePaymentAmount}
            onChange={(e) => setPrePaymentAmount(e.target.value)}
            placeholder="100000000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <JalaliDatePicker
            label={t('contracts.startDate')}
            value={startDate}
            onChange={(val) => setStartDate(val)}
            isRequired
          />

          <JalaliDatePicker
            label={t('contracts.endDate')}
            value={endDate}
            onChange={(val) => setEndDate(val)}
          />
        </div>

        <Textarea
          label={t('contracts.terms')}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          placeholder={isRtl ? 'شروط تحویل، جرایم تاخیر، شروط فسخ و ضمانت‌ها...' : 'Delivery terms, penalty clauses, warranty notes...'}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {contractToEdit ? t('common.save') : t('contracts.newContractBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
