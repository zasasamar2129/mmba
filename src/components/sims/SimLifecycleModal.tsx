import React, { useState, useEffect } from 'react';
import { SimCard, Customer, Contract, User } from '../../types';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { RTLNumber } from '../ui/RTLNumber';
import {
  Bookmark, CheckCircle2, XCircle, ArrowRightLeft, DollarSign,
  Calendar, UserCheck, ShieldCheck, Tag, ShoppingCart, Lock, Handshake
} from 'lucide-react';

export type LifecycleMode = 'RESERVE' | 'CANCEL_RESERVE' | 'SELL' | 'MORTGAGE' | 'CONSIGNMENT';

export interface SimLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sim: SimCard | null;
  mode: LifecycleMode;
  customers: Customer[];
  contracts: Contract[];
  currentUser: User;
  allUsers?: User[];
  onSuccess: (updatedSim: SimCard) => void;
}

export const SimLifecycleModal: React.FC<SimLifecycleModalProps> = ({
  isOpen,
  onClose,
  sim,
  mode,
  customers = [],
  contracts = [],
  currentUser,
  allUsers = [],
  onSuccess,
}) => {
  const { isRtl } = useTranslation();
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Reservation State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [reservationDeadline, setReservationDeadline] = useState('');
  const [reservationNotes, setReservationNotes] = useState('');

  // Cancellation State
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundRequired, setRefundRequired] = useState(true);

  // Sale State
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleContractId, setSaleContractId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('OFFICE_PICKUP');
  const [buyerMobile, setBuyerMobile] = useState('');
  const [buyerNationalId, setBuyerNationalId] = useState('');

  // Mortgage State
  const [isMortgaged, setIsMortgaged] = useState(true);
  const [mortgageeName, setMortgageeName] = useState('');
  const [mortgageAmount, setMortgageAmount] = useState('');
  const [mortgageStartDate, setMortgageStartDate] = useState('');
  const [mortgageEndDate, setMortgageEndDate] = useState('');
  const [mortgageNotes, setMortgageNotes] = useState('');

  // Consignment State (امانی)
  const [consOwnerCustomerId, setConsOwnerCustomerId] = useState('');
  const [consRequestedPrice, setConsRequestedPrice] = useState('');
  const [consCommissionType, setConsCommissionType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [consCommissionValue, setConsCommissionValue] = useState('');
  const [consAgreedTerms, setConsAgreedTerms] = useState('');
  const [consResponsibleUserId, setConsResponsibleUserId] = useState('');
  const [consExpiryAt, setConsExpiryAt] = useState('');
  const [consNotes, setConsNotes] = useState('');

  useEffect(() => {
    if (sim && isOpen) {
      try {
        if (mode === 'RESERVE') {
          setSelectedCustomerId(sim.reservationCustomerId || sim.customerId || '');
          setDepositAmount(sim.depositAmount ? String(sim.depositAmount) : '');
          setReservationDeadline(sim.reservationExpireAt || '');
          setReservationNotes(sim.reservationNotes || '');
        } else if (mode === 'SELL') {
          setSaleCustomerId(sim.customerId || sim.reservationCustomerId || '');
          setSalePrice(sim.salePrice ? String(sim.salePrice) : '');
          setDeliveryMethod('OFFICE_PICKUP');
          setSaleContractId('');
          setBuyerMobile('');
          setBuyerNationalId('');
        } else if (mode === 'MORTGAGE') {
          setIsMortgaged(Boolean(sim.isMortgaged ?? true));
          setMortgageeName(sim.mortgageeName || sim.ownerCustomerName || '');
          setMortgageAmount(sim.mortgageAmount ? String(sim.mortgageAmount) : '');
          setMortgageStartDate(sim.mortgageStartDate || new Date().toISOString().slice(0, 10));
          setMortgageEndDate(sim.mortgageEndDate || '');
          setMortgageNotes(sim.mortgageNotes || '');
        } else if (mode === 'CONSIGNMENT') {
          setConsOwnerCustomerId(sim.ownerCustomerId || '');
          setConsRequestedPrice(sim.salePrice ? String(sim.salePrice) : '');
          setConsCommissionType('PERCENTAGE');
          setConsCommissionValue('');
          setConsAgreedTerms('');
          setConsResponsibleUserId(currentUser.id);
          setConsExpiryAt('');
          setConsNotes('');
        }
      } catch (err) {
        console.error('Error initializing lifecycle modal state:', err);
      }
    }
  }, [sim, mode, isOpen]);

  if (!isOpen || !sim) return null;

  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      error(isRtl ? 'لطفاً مشتری رزروکننده را انتخاب فرمایید.' : 'Please select the reserving customer.');
      return;
    }
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const deposit = Number(depositAmount.replace(/,/g, '')) || 0;

    setIsLoading(true);
    try {
      const updated = await storage.reserveSimCard(sim.id, {
        customerId: selectedCustomerId,
        customerName: customer?.name || (isRtl ? 'مشتری نامشخص' : 'Unknown customer'),
        depositAmount: deposit,
        deadline: reservationDeadline || undefined,
        notes: reservationNotes || undefined,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      success(isRtl ? `سیم‌کارت ${sim.phoneNumber} با موفقیت رزرو شد.` : `SIM ${sim.phoneNumber} reserved successfully.`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت رزرو سیم‌کارت' : 'Error reserving SIM card'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = await storage.cancelSimReservation(sim.id, {
        reason: cancellationReason || (isRtl ? 'انصراف مشتری' : 'Customer cancelled'),
        refundDeposit: refundRequired,
      });
      success(`رزرو سیم‌کارت ${sim.phoneNumber} لغو گردید و به وضعیت موجود بازگشت.`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در لغو رزرو' : 'Error cancelling reservation'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerId) {
      error(isRtl ? 'لطفاً مشتری خریدار را انتخاب کنید.' : 'Please select the buying customer.');
      return;
    }
    const customer = (customers || []).find((c) => c.id === saleCustomerId);
    const price = Number(salePrice.replace(/,/g, '')) || sim.salePrice || 0;
    const contract = (contracts || []).find((ct) => ct.id === saleContractId);

    setIsLoading(true);
    try {
      const updated = await storage.sellSimCard(sim.id, {
        customerId: saleCustomerId,
        customerName: customer?.name || (isRtl ? 'مشتری خریدار' : 'Buyer'),
        contractId: saleContractId || `cnt-auto-${Date.now()}`,
        contractNumber: contract?.contractNumber || `CNT-${Date.now().toString().slice(-5)}`,
        salePrice: price,
        buyerMobile: buyerMobile || customer?.phone,
        buyerNationalId: buyerNationalId || customer?.nationalId,
        deliveryMethod,
      });
      success(isRtl ? `فروش سیم‌کارت ${sim.phoneNumber} ثبت و وضعیت به فروخته شده تغییر یافت.` : `SIM ${sim.phoneNumber} sold, status changed to Sold.`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت فروش سیم‌کارت' : 'Error registering SIM sale'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMortgageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(mortgageAmount.replace(/,/g, '')) || 0;

    setIsLoading(true);
    try {
      const updated = await storage.mortgageSimCard(sim.id, {
        isMortgaged,
        mortgageeName,
        mortgageAmount: amount,
        mortgageStartDate,
        mortgageEndDate,
        notes: mortgageNotes,
      });
      success(isMortgaged ? (isRtl ? `وضعیت رهن سیم‌کارت ${sim.phoneNumber} ثبت شد.` : `Mortgage status for SIM ${sim.phoneNumber} registered.`) : (isRtl ? `رهن سیم‌کارت فک و آزاد گردید.` : `Mortgage on SIM released.`));
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت رهن' : 'Error registering mortgage'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consOwnerCustomerId) {
      error(isRtl ? 'لطفاً مالک / مشتری صاحب سیم‌کارت را انتخاب فرمایید.' : 'Please select the SIM owner / customer.');
      return;
    }
    if (!consRequestedPrice) {
      error(isRtl ? 'لطفاً قیمت پیشنهادی مالک را وارد کنید.' : 'Please enter the owner requested price.');
      return;
    }
    if (!consResponsibleUserId) {
      error(isRtl ? 'لطفاً مسئول پیگیری را انتخاب کنید.' : 'Please select the responsible user.');
      return;
    }
    const ownerCustomer = (customers || []).find((c) => c.id === consOwnerCustomerId);
    const responsibleUser = (allUsers && allUsers.length > 0 ? allUsers : [currentUser]).find((u) => u.id === consResponsibleUserId) || currentUser;
    const requestedPrice = Number(consRequestedPrice.replace(/,/g, '')) || 0;
    const commissionValue = Number(consCommissionValue.replace(/,/g, '')) || 0;

    setIsLoading(true);
    try {
      const consignment = storage.saveConsignment({
        simId: sim.id,
        simPhoneNumber: sim.phoneNumber,
        ownerCustomerId: consOwnerCustomerId,
        ownerCustomerName: ownerCustomer?.name || (isRtl ? 'مشتری نامشخص' : 'Unknown customer'),
        receivedAt: new Date().toISOString(),
        requestedPrice,
        commissionType: consCommissionType,
        commissionValue,
        agreedTerms: consAgreedTerms.trim(),
        responsibleUserId: consResponsibleUserId,
        responsibleUserName: responsibleUser.name,
        expiryAt: consExpiryAt || undefined,
        status: 'CONSIGNMENT',
        notes: consNotes.trim() || undefined,
      });

      // Update SIM to consignment status
      const updatedSim = await storage.saveSimCard({
        ...sim,
        status: 'CONSIGNMENT' as any,
        ownerCustomerId: consOwnerCustomerId,
        ownerCustomerName: ownerCustomer?.name,
        consignmentId: consignment.id,
        isConsigned: true,
        consignmentStatus: 'CONSIGNMENT',
        updatedAt: new Date().toISOString(),
      });

      storage.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'CREATE_CONSIGNMENT',
        module: 'CONSIGNMENTS',
        entityType: 'CONSIGNMENT',
        entityName: `سیم‌کارت ${sim.phoneNumber}`,
        targetId: consignment.id,
        details: `ثبت امانی سیم‌کارت ${sim.phoneNumber} از ${ownerCustomer?.name || ''} با قیمت پیشنهادی ${requestedPrice}`,
      });

      success(isRtl ? `سیم‌کارت ${sim.phoneNumber} به صورت امانی از ${ownerCustomer?.name || ''} ثبت شد.` : `SIM ${sim.phoneNumber} registered on consignment from ${ownerCustomer?.name || ''}.`);
      onSuccess(updatedSim);
      onClose();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت امانی سیم‌کارت' : 'Error registering consignment'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'RESERVE'
          ? (isRtl ? `رزرو و دریافت بیعانه: ${sim.phoneNumber}` : `Reserve & Deposit: ${sim.phoneNumber}`)
          : mode === 'CANCEL_RESERVE'
          ? (isRtl ? `لغو رزرو سیم‌کارت: ${sim.phoneNumber}` : `Cancel SIM Reservation: ${sim.phoneNumber}`)
          : mode === 'SELL'
          ? (isRtl ? `{isRtl ? 'ثبت فروش قطعی' : 'Confirm Sale'} سیم‌کارت: ${sim.phoneNumber}` : `Register SIM Sale: ${sim.phoneNumber}`)
          : mode === 'CONSIGNMENT'
          ? (isRtl ? `ثبت امانی سیم‌کارت: ${sim.phoneNumber}` : `Register Consignment: ${sim.phoneNumber}`)
          : (isRtl ? `مدیریت رهن و تسهیلات: ${sim.phoneNumber}` : `Mortgage Management: ${sim.phoneNumber}`)
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* SIM Info Header */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-extrabold text-indigo-600 dark:text-indigo-400">
              {sim.phoneNumber}
            </span>
            <Badge variant="default" size="sm">{sim.operator}</Badge>
          </div>
          <div className="text-xs text-slate-500">
            {isRtl ? 'قیمت پایه:' : 'Base Price:'} <span className="font-bold text-slate-800 dark:text-slate-200"><RTLNumber value={sim.salePrice || 0} type="price" /></span>
          </div>
        </div>

        {/* RESERVE MODE */}
        {mode === 'RESERVE' && (
          <form onSubmit={handleReserveSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'مشتری رزروکننده' : 'Reserving Customer'}
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                isRequired
              >
                <option value="">{isRtl ? '-- انتخاب مشتری --' : '-- Select customer --'}</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || ''})</option>
                ))}
              </Select>

              <Input
                label={isRtl ? 'مبلغ بیعانه دریافتی (تومان)' : 'Deposit Received (Toman)'}
                placeholder={isRtl ? 'مثال: ۵,۰۰۰,۰۰۰' : 'e.g. 5,000,000'}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                isRequired
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'مهلت رزرو تا تاریخ' : 'Reservation Deadline'}
                type="date"
                value={reservationDeadline}
                onChange={(e) => setReservationDeadline(e.target.value)}
              />
              <Input
                label={isRtl ? 'ثبت‌کننده رزرو' : 'Reserved By'}
                value={currentUser.name}
                disabled
              />
            </div>

            <Textarea
              label={isRtl ? 'توضیحات و شرایط توافق بیعانه' : 'Deposit Terms & Notes'}
              placeholder={isRtl ? 'مثال: در صورت عدم تسویه تا ۴۸ ساعت، بیعانه مسترد نمی‌گردد...' : 'e.g. If not settled within 48h, deposit non-refundable...'}
              value={reservationNotes}
              onChange={(e) => setReservationNotes(e.target.value)}
              rows={2}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isLoading} leftIcon={<Bookmark className="w-4 h-4" />}>
                {isRtl ? 'تایید و ثبت رزرو' : 'Confirm & Reserve'}
              </Button>
            </div>
          </form>
        )}

        {/* CANCEL RESERVE MODE */}
        {mode === 'CANCEL_RESERVE' && (
          <form onSubmit={handleCancelReserveSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              {isRtl ? `این سیم‌کارت در حال حاضر به نام «${sim.reservationCustomerName || 'مشتری'}» رزرو است. با لغو رزرو، وضعیت خط به موجود (AVAILABLE) تغییر خواهد یافت.` : `This SIM is currently reserved to "${sim.reservationCustomerName || 'Customer'}". Cancelling will change status to Available.`}
            </div>

            <Textarea
              label={isRtl ? 'دلیل لغو رزرو (الزامی)' : 'Cancellation Reason (Required)'}
              placeholder={isRtl ? 'مثال: انصراف مشتری، اتمام مهلت ۴۸ ساعته، عدم توافق قیمت...' : 'e.g. Customer cancelled, 48h deadline expired, price disagreement...'}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={2}
              isRequired
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
              <Button variant="danger" size="sm" type="submit" isLoading={isLoading} leftIcon={<XCircle className="w-4 h-4" />}>
                {isRtl ? 'تایید لغو رزرو' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        )}

        {/* SELL MODE */}
        {mode === 'SELL' && (
          <form onSubmit={handleSellSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'مشتری خریدار' : 'Buying Customer'}
                value={saleCustomerId}
                onChange={(e) => {
                  setSaleCustomerId(e.target.value);
                  const cust = (customers || []).find((c) => c.id === e.target.value);
                  if (cust) {
                    setBuyerMobile(cust.phone || '');
                    setBuyerNationalId(cust.nationalId || '');
                  }
                }}
                isRequired
              >
                <option value="">{isRtl ? '-- انتخاب خریدار --' : '-- Select buyer --'}</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || ''})</option>
                ))}
              </Select>

              <Input
                label={isRtl ? 'قیمت فروش نهایی (تومان)' : 'Final Sale Price (Toman)'}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                isRequired
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'قرارداد مرتبط (اختیاری)' : 'Related Contract (Optional)'}
                value={saleContractId}
                onChange={(e) => setSaleContractId(e.target.value)}
              >
                <option value="">{isRtl ? '-- ایجاد قرارداد خودکار یا بدون قرارداد --' : '-- Auto-create contract or none --'}</option>
                {(contracts || []).map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.contractNumber || ''} - {ct.title || ''}
                  </option>
                ))}
              </Select>

              <Select
                label={isRtl ? 'شیوه تحویل سیم‌کارت' : 'Delivery Method'}
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              >
                <option value="OFFICE_PICKUP">{isRtl ? 'تحویل حضوری در دفتر' : 'Office Pickup'}</option>
                <option value="COURIER">{isRtl ? 'ارسال با پیک / پست پیشتاز' : 'Courier / Express Post'}</option>
                <option value="NAME_TRANSFER">{isRtl ? 'انتقال سند در دفتر پیشخوان' : 'Title Transfer at Office'}</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isLoading} leftIcon={<ShoppingCart className="w-4 h-4" />}>
                {isRtl ? 'ثبت فروش قطعی' : 'Confirm Sale'}
              </Button>
            </div>
          </form>
        )}

        {/* MORTGAGE MODE */}
        {mode === 'MORTGAGE' && (
          <form onSubmit={handleMortgageSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'نام شخص یا نهاد مرتهن (وثیقه‌گذار / وام‌دهنده)' : 'Mortgagee Name (Lender / Creditor)'}
                placeholder={isRtl ? 'مثال: بانک ملی / شخص سرمایه‌گذار' : 'e.g. National Bank / Private Investor'}
                value={mortgageeName}
                onChange={(e) => setMortgageeName(e.target.value)}
                isRequired
              />

              <Input
                label={isRtl ? 'مبلغ رهن / ارزش وثیقه (تومان)' : 'Mortgage Amount / Collateral Value (Toman)'}
                placeholder={isRtl ? 'مثال: ۵۰,۰۰۰,۰۰۰' : 'e.g. 50,000,000'}
                value={mortgageAmount}
                onChange={(e) => setMortgageAmount(e.target.value)}
                isRequired
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'تاریخ شروع رهن' : 'Mortgage Start Date'}
                type="date"
                value={mortgageStartDate}
                onChange={(e) => setMortgageStartDate(e.target.value)}
              />
              <Input
                label={isRtl ? 'تاریخ سررسید / پایان رهن' : 'Mortgage Due / End Date'}
                type="date"
                value={mortgageEndDate}
                onChange={(e) => setMortgageEndDate(e.target.value)}
              />
            </div>

            <Textarea
              label={isRtl ? 'توضیحات و شرایط فک رهن' : 'Mortgage Release Terms'}
              placeholder={isRtl ? 'توضیحات توافق بازپرداخت و انتقال سند پس از تسویه...' : 'e.g. Repayment terms, title transfer after settlement...'}
              value={mortgageNotes}
              onChange={(e) => setMortgageNotes(e.target.value)}
              rows={2}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isLoading} leftIcon={<Lock className="w-4 h-4" />}>
                ذخیره وضعیت رهن
              </Button>
            </div>
          </form>
        )}

        {/* CONSIGNMENT MODE (امانی) */}
        {mode === 'CONSIGNMENT' && (
          <form onSubmit={handleConsignmentSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs leading-relaxed">
              سیم‌کارت به صورت «امانی» از مالک دریافت می‌شود. مالک باید از مشتری‌های ثبت‌شده در سیستم انتخاب شود و پس از فروش، مبلغ قابل تسویه بر اساس قیمت واقعی و کمیسیون توافق‌شده محاسبه می‌گردد.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'مالک / مشتری صاحب سیم‌کارت' : 'Owner / SIM Holder'}
                value={consOwnerCustomerId}
                onChange={(e) => setConsOwnerCustomerId(e.target.value)}
                isRequired
              >
                <option value="">-- انتخاب مالک از مشتریان سیستم --</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || ''})</option>
                ))}
              </Select>

              <Input
                label={isRtl ? 'قیمت پیشنهادی مالک (تومان)' : 'Owner Requested Price (Toman)'}
                value={consRequestedPrice}
                onChange={(e) => setConsRequestedPrice(e.target.value)}
                isRequired
                placeholder={isRtl ? 'مثال: ۸۵۰,۰۰۰,۰۰۰' : 'e.g. 850,000,000'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {isRtl ? 'نوع کمیسیون' : 'Commission Type'} <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConsCommissionType('PERCENTAGE')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-all ${
                      consCommissionType === 'PERCENTAGE'
                        ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    درصدی از فروش
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsCommissionType('FIXED')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-all ${
                      consCommissionType === 'FIXED'
                        ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    مبلغ ثابت
                  </button>
                </div>
              </div>

              <Input
                label={consCommissionType === 'PERCENTAGE' ? (isRtl ? 'درصد کمیسیون (مثال: ۵)' : 'Commission % (e.g. 5)') : (isRtl ? 'مبلغ کمیسیون (تومان)' : 'Commission Amount (Toman)')}
                value={consCommissionValue}
                onChange={(e) => setConsCommissionValue(e.target.value)}
                isRequired
                placeholder={consCommissionType === 'PERCENTAGE' ? (isRtl ? '۵' : '5') : (isRtl ? 'مثال: ۱۰,۰۰۰,۰۰۰' : 'e.g. 10,000,000')}
              />
            </div>

            <Textarea
              label={isRtl ? 'شرایط توافق' : 'Agreed Terms'}
              placeholder={isRtl ? 'مثال: سیم‌کارت تا ۳ ماه در اختیار فروشگاه؛ فروش فقط نقدی؛ عدم مسئولیت در صورت مفقودی...' : 'e.g. SIM held 3 months; cash-only sale; no liability if lost...'}
              value={consAgreedTerms}
              onChange={(e) => setConsAgreedTerms(e.target.value)}
              rows={2}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'مسئول پیگیری' : 'Responsible User'}
                value={consResponsibleUserId}
                onChange={(e) => setConsResponsibleUserId(e.target.value)}
                isRequired
              >
                <option value="">-- انتخاب مسئول پیگیری --</option>
                {(allUsers && allUsers.length > 0 ? allUsers : [currentUser]).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>

              <Input
                label={isRtl ? 'تاریخ پایان امانت (اختیاری)' : 'Consignment End Date (Optional)'}
                type="date"
                value={consExpiryAt}
                onChange={(e) => setConsExpiryAt(e.target.value)}
              />
            </div>

            <Textarea
              label={isRtl ? 'توضیحات و اسناد مرتبط' : 'Notes & Related Documents'}
              placeholder={isRtl ? 'توضیحات تکمیلی...' : 'Additional notes...'}
              value={consNotes}
              onChange={(e) => setConsNotes(e.target.value)}
              rows={2}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isLoading} leftIcon={<Handshake className="w-4 h-4" />}>
                ثبت امانی سیم‌کارت
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
