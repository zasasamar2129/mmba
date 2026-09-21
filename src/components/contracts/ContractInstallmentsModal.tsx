import React, { useState, useEffect, useMemo } from 'react';
import { Contract, ContractInstallment, Payment, User } from '../../types';
import { storage, subscribeToStorage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { RTLNumber } from '../ui/RTLNumber';
import { formatToman } from '../../lib/currencyUtils';
import {
  Calendar, CheckCircle2, Clock, AlertCircle, DollarSign,
  CreditCard, Plus, ArrowUpRight, ShieldCheck, Check,
  FileCheck, Receipt
} from 'lucide-react';

export interface ContractInstallmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  currentUser: User;
}

export const ContractInstallmentsModal: React.FC<ContractInstallmentsModalProps> = ({
  isOpen,
  onClose,
  contract,
  currentUser,
}) => {
  const { success, error } = useToast();
  const { isRtl } = useTranslation();
  const [installments, setInstallments] = useState<ContractInstallment[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<ContractInstallment | null>(null);

  // Record Payment Modal
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CARD_TO_CARD');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [needsFinanceReview, setNeedsFinanceReview] = useState(true);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadData = () => {
    if (!contract) return;
    const list = storage.getContractInstallments(contract.id);
    setInstallments(list.sort((a, b) => a.installmentNumber - b.installmentNumber));
  };

  useEffect(() => {
    if (isOpen && contract) {
      loadData();
      return subscribeToStorage((event) => {
        if (event.key === 'CONTRACT_INSTALLMENTS' || event.key === 'PAYMENTS' || event.key === 'ALL') {
          loadData();
        }
      });
    }
  }, [isOpen, contract]);

  const summary = useMemo(() => {
    const totalAmount = installments.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const paidAmount = installments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const percent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
    const paidCount = installments.filter((i) => i.status === 'PAID').length;
    const totalCount = installments.length;

    return { totalAmount, paidAmount, remainingAmount, percent, paidCount, totalCount };
  }, [installments]);

  if (!isOpen || !contract) return null;

  const handleOpenPay = (inst: ContractInstallment) => {
    setSelectedInstallment(inst);
    const remaining = (inst.totalAmount || 0) - (inst.paidAmount || 0);
    setPayAmount(String(remaining > 0 ? remaining : inst.totalAmount));
    setPayMethod('CARD_TO_CARD');
    setPayRef('');
    setPayNotes('');
    setNeedsFinanceReview(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    const amount = Number(payAmount.replace(/,/g, '')) || 0;
    if (amount <= 0) {
      error(isRtl ? 'مبلغ پرداختی معتبر وارد نمایید.' : 'Enter a valid payment amount.');
      return;
    }

    setIsSubmittingPay(true);
    try {
      await storage.recordInstallmentPayment({
        installmentId: selectedInstallment.id,
        amount,
        paymentMethod: payMethod,
        paymentReference: payRef.trim() || undefined,
        recordedByUserId: currentUser.id,
        recordedByUserName: currentUser.name,
        notes: payNotes.trim() || undefined,
        needsFinanceReview,
      });

      success(`واریز مبلغ ${formatToman(amount)} با موفقیت ثبت گردید.`);
      setSelectedInstallment(null);
      loadData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ثبت پرداخت قسط' : 'Error recording installment payment'));
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'PAID':
        return <Badge variant="emerald" size="sm">{isRtl ? 'تسویه کامل' : 'Paid in Full'}</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning" size="sm">{isRtl ? 'پرداخت ناقص' : 'Partial'}</Badge>;
      case 'OVERDUE':
        return <Badge variant="danger" size="sm">{isRtl ? 'دارای تاخیر / معوق' : 'Overdue'}</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="default" size="sm">{isRtl ? 'در انتظار سررسید' : 'Pending Due'}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`جدول اقساط قرارداد: ${contract.contractNumber}`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Contract & Progress Summary */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs text-slate-400">{isRtl ? 'عنوان قرارداد / مشتری:' : 'Contract / Customer:'}</span>
              <p className="font-extrabold text-base text-slate-100">{contract.title || contract.contractNumber}</p>
              <p className="text-xs text-indigo-300 font-mono mt-0.5">{contract.customerName}</p>
            </div>
            <div className="text-start">
              <span className="text-xs text-slate-400">{isRtl ? 'وصول شده:' : 'Collected:'}</span>
              <p className="text-lg font-mono font-extrabold text-emerald-400">
                <RTLNumber value={summary.paidAmount} type="price" />
              </p>
              <span className="text-[11px] text-slate-400">{isRtl ? 'از کل' : 'of'} <RTLNumber value={summary.totalAmount} type="price" /></span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-slate-300 font-semibold">
              <span>{isRtl ? 'پیشرفت تسویه اقساط' : 'Installment Progress'} ({summary.paidCount} {isRtl ? 'از' : 'of'} {summary.totalCount} {isRtl ? 'قسط' : 'installments'})</span>
              <span>{summary.percent}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${summary.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Installments Table */}
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pe-1">
          {installments.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
              <Calendar className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold">{isRtl ? 'هیچ قسطی برای این قرارداد ثبت نشده است.' : 'No installments recorded for this contract.'}</p>
              <p className="text-xs text-slate-400 mt-1">{isRtl ? 'جدول اقساط در زمان ثبت قراردادهای اقساطی یا رهن به صورت خودکار ایجاد می‌گردد.' : 'The installment table is auto-created for installment or mortgage contracts.'}</p>
            </div>
          ) : (
            installments.map((inst) => {
              const remaining = Math.max(0, (inst.totalAmount || 0) - (inst.paidAmount || 0));
              const isPaid = inst.status === 'PAID';

              return (
                <div
                  key={inst.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isPaid
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : inst.status === 'OVERDUE'
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        قسط شماره {inst.installmentNumber}
                      </span>
                      {getStatusBadge(inst.status)}
                      {inst.financeReviewStatus === 'PENDING_REVIEW' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30">
                          در انتظار تطبیق مالی
                        </span>
                      )}
                      {inst.financeReviewStatus === 'REVIEWED' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          تایید مالی
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isRtl ? 'سررسید:' : 'Due:'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{inst.dueDate}</span>
                      </span>
                      <span>
                        {isRtl ? 'مبلغ قسط:' : 'Installment:'} <span className="font-bold text-slate-800 dark:text-slate-200"><RTLNumber value={inst.totalAmount} type="price" /></span>
                      </span>
                      {inst.paidAmount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {isRtl ? 'پرداخت شده:' : 'Paid:'} <RTLNumber value={inst.paidAmount} type="price" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isPaid ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isRtl ? 'تسویه کامل' : 'Paid in Full'}</span>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenPay(inst)}
                        leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                        className="font-bold text-xs shadow-sm"
                      >
                        {isRtl ? 'ثبت واریز قسط' : 'Pay Installment'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Record Payment Sub-modal */}
      {selectedInstallment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInstallment(null)}
          title={`{isRtl ? 'ثبت واریز قسط' : 'Pay Installment'} شماره ${selectedInstallment.installmentNumber}`}
          size="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
              <span>{isRtl ? 'مبلغ کل این قسط:' : 'Installment Total:'}</span>
              <span className="font-bold font-mono text-sm"><RTLNumber value={selectedInstallment.totalAmount} type="price" /></span>
            </div>

            <Input
              label={isRtl ? 'مبلغ واریزی به تومان (پشتیبانی از تسویه کامل یا پرداخت علی‌الحساب)' : 'Payment Amount (Toman) - full or partial'}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              isRequired
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={isRtl ? 'شیوه واریز / درگاه' : 'Payment Method'}
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <option value="CARD_TO_CARD">{isRtl ? 'کارت به کارت' : 'Card to Card'}</option>
                <option value="PAYA_SATNA">{isRtl ? 'حواله پایا / ساتنا' : 'PAYA / SATNA Transfer'}</option>
                <option value="POS_MACHINE">{isRtl ? 'دستگاه کارتخوان (POS)' : 'POS Card Reader'}</option>
                <option value="CHEQUE">{isRtl ? 'چک صیادی' : 'Sayad Check'}</option>
                <option value="CASH">{isRtl ? 'نقدی' : 'Cash'}</option>
              </Select>

              <Input
                label={isRtl ? 'شماره پیگیری / مرجع بانکی' : 'Tracking / Bank Reference'}
                placeholder={isRtl ? 'مثال: 849204820' : 'e.g. 849204820'}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>

            <Textarea
              label={isRtl ? 'توضیحات واریز' : 'Payment Notes'}
              placeholder={isRtl ? 'مثال: واریز به حساب بانک ملت شرکت توسط مشتری...' : 'e.g. Transfer to company Mellat account by customer...'}
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              rows={2}
            />

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={needsFinanceReview}
                onChange={(e) => setNeedsFinanceReview(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="font-medium">{isRtl ? 'ارجاع به مدیریت مالی جهت بررسی و تطبیق سند' : 'Refer to Finance for document review'} (Finance Review)</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setSelectedInstallment(null)}
              >
                انصراف
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmittingPay}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold"
              >
                تایید و ثبت پرداخت
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
};
