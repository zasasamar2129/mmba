import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SimCard, SimOperator, SimType, SimStatus, Customer, RegisteredHolder } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { Smartphone, Check, Sparkles, DollarSign, UserCheck, ShieldAlert, Lock } from 'lucide-react';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface SimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  simToEdit?: SimCard | null;
  allCustomers: Customer[];
  onSaved: (sim: SimCard) => void;
}

export const SimFormModal: React.FC<SimFormModalProps> = ({
  isOpen,
  onClose,
  simToEdit,
  allCustomers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatCurrency } = useTranslation();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [operator, setOperator] = useState<SimOperator>(SimOperator.MCI);
  const [type, setType] = useState<SimType>(SimType.PERMANENT);
  const [status, setStatus] = useState<SimStatus>(SimStatus.AVAILABLE);
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isRound, setIsRound] = useState(false);
  const [roundCategory, setRoundCategory] = useState('');
  const [ownerCustomerId, setOwnerCustomerId] = useState('');
  const [registeredHolderId, setRegisteredHolderId] = useState('');
  const [registeredHolders, setRegisteredHolders] = useState<RegisteredHolder[]>([]);
  const [notes, setNotes] = useState('');

  // Purchase details
  const [purchaseSourceType, setPurchaseSourceType] = useState<'CUSTOMER' | 'INTERNAL'>('INTERNAL');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Mortgage details
  const [isMortgaged, setIsMortgaged] = useState(false);
  const [mortgageeName, setMortgageeName] = useState('');
  const [mortgageAmount, setMortgageAmount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRegisteredHolders(storage.getRegisteredHolders());
    }
  }, [isOpen]);

  useEffect(() => {
    if (simToEdit) {
      setPhoneNumber(simToEdit.phoneNumber || '');
      setOperator(simToEdit.operator || SimOperator.MCI);
      setType(simToEdit.type || SimType.PERMANENT);
      setStatus(simToEdit.status || SimStatus.AVAILABLE);
      setCostPrice(String(simToEdit.costPrice || ''));
      setSalePrice(String(simToEdit.salePrice || ''));
      setIsRound(Boolean(simToEdit.isRound));
      setRoundCategory(simToEdit.roundCategory || '');
      setOwnerCustomerId(simToEdit.ownerCustomerId || '');
      setRegisteredHolderId(simToEdit.registeredHolderId || '');
      setNotes(simToEdit.notes || '');
      setPurchaseSourceType(simToEdit.purchaseSourceType || 'INTERNAL');
      setPurchasePrice(simToEdit.purchasePrice ? String(simToEdit.purchasePrice) : '');
      setIsMortgaged(Boolean(simToEdit.isMortgaged));
      setMortgageeName(simToEdit.mortgageeName || '');
      setMortgageAmount(simToEdit.mortgageAmount ? String(simToEdit.mortgageAmount) : '');
    } else {
      setPhoneNumber('0912');
      setOperator(SimOperator.MCI);
      setType(SimType.PERMANENT);
      setStatus(SimStatus.AVAILABLE);
      setCostPrice('');
      setSalePrice('');
      setIsRound(true);
      setRoundCategory(isRtl ? 'رند پله‌ای از اول / آینه‌ای' : 'Step / Mirror Pattern');
      setOwnerCustomerId('');
      setRegisteredHolderId('');
      setNotes('');
      setPurchaseSourceType('INTERNAL');
      setPurchasePrice('');
      setIsMortgaged(false);
      setMortgageeName('');
      setMortgageAmount('');
    }
  }, [simToEdit, isOpen, isRtl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || phoneNumber.length < 11) {
      error(isRtl ? 'لطفاً شماره تلفن همراه ۱۱ رقمی معتبر را وارد کنید' : 'Please enter a valid 11-digit mobile phone number');
      return;
    }
    const numCost = Number(costPrice.replace(/,/g, '')) || 0;
    const numSale = Number(salePrice.replace(/,/g, '')) || 0;
    const numPurchase = Number(purchasePrice.replace(/,/g, '')) || numCost;
    const numMortgage = Number(mortgageAmount.replace(/,/g, '')) || 0;

    const selectedCust = allCustomers.find((c) => c.id === ownerCustomerId);
    const selectedHolder = registeredHolders.find((h) => h.id === registeredHolderId);

    if (registeredHolderId && selectedHolder) {
      if (selectedHolder.isAtCapacity && simToEdit?.registeredHolderId !== registeredHolderId) {
        error(`شخص انتخاب شده (${selectedHolder.fullName}) به سقف قانونی ۱۰ سیم‌کارت رسیده است. لطفاً شخص دیگری را انتخاب فرمایید.`);
        return;
      }
    }

    const payload: SimCard = {
      id: simToEdit?.id || '',
      phoneNumber: phoneNumber.trim(),
      operator,
      type,
      status,
      costPrice: numCost,
      salePrice: numSale,
      isRound,
      roundCategory: isRound ? roundCategory.trim() : undefined,
      ownerCustomerId: ownerCustomerId || undefined,
      ownerCustomerName: selectedCust?.name || undefined,
      registeredHolderId: registeredHolderId || undefined,
      registeredHolderName: selectedHolder?.fullName || undefined,
      purchaseSourceType,
      purchasePrice: numPurchase,
      isMortgaged,
      mortgageeName: isMortgaged ? mortgageeName : undefined,
      mortgageAmount: isMortgaged ? numMortgage : undefined,
      notes: notes.trim() || undefined,
      createdAt: simToEdit?.createdAt || '',
      updatedAt: '',
    };

    const saved = storage.saveSimCard(payload);
    success(simToEdit ? (isRtl ? 'اطلاعات سیم‌کارت ویرایش شد' : 'SIM card details updated') : (isRtl ? 'سیم‌کارت جدید به موجودی اضافه شد' : 'New SIM card added to inventory'));
    onSaved(saved);
    onClose();
  };

  const rawSale = Number(salePrice.replace(/,/g, '')) || 0;
  const rawCost = Number(costPrice.replace(/,/g, '')) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <span>{simToEdit ? t('sims.editSimModalTitle') : t('sims.newSimModalTitle')}</span>
        </div>
      }
      subtitle={t('sims.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label={isRtl ? 'شماره خط (۱۱ رقم)' : 'Phone Number (11 digits)'}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="09121112233"
            isRequired
            className="font-mono text-center tracking-widest text-base"
          />

          <Select
            label={t('sims.operator')}
            value={operator}
            onChange={(e) => setOperator(e.target.value as SimOperator)}
            options={[
              { value: SimOperator.MCI, label: `${t('sims.mci')} (MCI)` },
              { value: SimOperator.IRANCELL, label: `${t('sims.irancell')} (MTN)` },
              { value: SimOperator.RIGHTEL, label: `${t('sims.rightel')} (Rightel)` },
              { value: SimOperator.SHATEL_MOBILE, label: t('sims.shatel') },
              { value: SimOperator.OTHER, label: isRtl ? 'سایر اپراتورها' : 'Other Operators' },
            ]}
          />

          <Select
            label={isRtl ? 'نوع سیم‌کارت' : 'SIM Type'}
            value={type}
            onChange={(e) => setType(e.target.value as SimType)}
            options={[
              { value: SimType.PERMANENT, label: t('sims.permanent') },
              { value: SimType.CREDIT, label: t('sims.creditType') },
              { value: SimType.DATA, label: isRtl ? 'دیتا / سازمانی' : 'Data / Enterprise' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={t('sims.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as SimStatus)}
            options={[
              { value: SimStatus.AVAILABLE, label: t('sims.statusAvailable') },
              { value: SimStatus.RESERVED, label: t('sims.statusReserved') },
              { value: SimStatus.SOLD, label: t('sims.statusSold') },
              { value: SimStatus.RENTED, label: t('sims.statusRented') },
              { value: SimStatus.SUSPENDED, label: isRtl ? 'توقیف / قطع یکطرفه' : 'Suspended' },
            ]}
          />

          <Select
            label={t('sims.ownerCustomer')}
            value={ownerCustomerId}
            onChange={(e) => setOwnerCustomerId(e.target.value)}
            options={[
              { value: '', label: isRtl ? 'در مالکیت شرکت (موجود در انبار)' : 'Company Owned (In Stock)' },
              ...(allCustomers || []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.mobile})`,
              })),
            ]}
          />
        </div>

        {/* Registered Holder (سندزن / قانون سقف ۱۰ سیم‌کارت) */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-slate-900/90 border border-indigo-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              <span>شخص ثبت‌کننده / سندزن (رگولاتوری - سقف ۱۰ خط)</span>
            </label>
            <span className="text-[11px] text-slate-400">قاعده حداکثر ۱۰ سیم‌کارت</span>
          </div>

          <Select
            value={registeredHolderId}
            onChange={(e) => setRegisteredHolderId(e.target.value)}
            options={[
              { value: '', label: '-- بدون شخص ثبت‌کننده ثانویه (شرکتی / نامشخص) --' },
              ...(registeredHolders || []).map((h) => ({
                value: h.id,
                label: `${h.fullName} (${h.nationalId}) - ${h.activeSimCount || 0}/10 خط فعال ${h.isAtCapacity ? '[تکمیل ظرفیت]' : ''}`,
                disabled: h.isAtCapacity && simToEdit?.registeredHolderId !== h.id,
              })),
            ]}
          />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <Input
              label={t('sims.costPrice')}
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="85000000"
            />
            {rawCost > 0 && (
              <p className="text-xs text-slate-400 text-start pe-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawCost)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Input
              label={t('sims.salePrice')}
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="120000000"
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
            />
            {rawSale > 0 && (
              <p className="text-xs text-emerald-400 font-semibold text-start pe-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawSale)}
              </p>
            )}
          </div>
        </div>

        {/* Round category */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
          <Checkbox
            checked={isRound}
            onChange={(e) => setIsRound(e.target.checked)}
            label={t('sims.isRound')}
            icon={<Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
            colorScheme="amber"
            size="md"
          />

          {isRound && (
            <Input
              label={t('sims.roundCategory')}
              value={roundCategory}
              onChange={(e) => setRoundCategory(e.target.value)}
              placeholder={isRtl ? 'مثال: رند تراز، رند هزاری، جفت جفت از آخر، پله‌ای' : 'e.g. Mirror, Consecutive, Repeating digits'}
            />
          )}
        </div>

        {/* Mortgage Details */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
          <Checkbox
            checked={isMortgaged}
            onChange={(e) => setIsMortgaged(e.target.checked)}
            label="این سیم‌کارت در رهن یا وثیقه است (رهنی / تسهیلاتی)"
            icon={<Lock className="w-4 h-4 text-purple-500" />}
            colorScheme="purple"
            size="md"
          />

          {isMortgaged && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="نام مرتهن / وام‌دهنده"
                value={mortgageeName}
                onChange={(e) => setMortgageeName(e.target.value)}
                placeholder="مثال: بانک سامان / سرمایه‌گذار"
              />
              <Input
                label="ارزش / مبلغ رهن (تومان)"
                value={mortgageAmount}
                onChange={(e) => setMortgageAmount(e.target.value)}
                placeholder="مثال: 40000000"
              />
            </div>
          )}
        </div>

        <Textarea
          label={t('sims.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={isRtl ? 'سند تک‌برگ، کارکرد صفر، بدون زنگ‌خور و...' : 'Notes, condition, history...'}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

