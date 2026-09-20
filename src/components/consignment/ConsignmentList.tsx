import React, { useState, useMemo } from 'react';
import { Consignment, Customer, User, SimCard, ConsignmentContact } from '../../types';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { formatToman } from '../../lib/currencyUtils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { RTLNumber } from '../ui/RTLNumber';
import {
  Handshake, Search, ShoppingCart, CheckCircle2, PhoneCall,
  MessageSquare, Mail, StickyNote, Undo2, Wallet, History, Eye
} from 'lucide-react';

export interface ConsignmentListProps {
  consignments: Consignment[];
  customers: Customer[];
  currentUser: User;
  allUsers: User[];
  sims: SimCard[];
  onRefresh: () => void;
}

type StatusFilter = 'ALL' | 'CONSIGNMENT' | 'SOLD' | 'RETURNED' | 'EXPIRED';

const statusBadge = (status: string, isRtl: boolean) => {
  switch (status) {
    case 'CONSIGNMENT':
      return <Badge variant="indigo" size="sm">{isRtl ? 'امانی (در جریان)' : 'Active'}</Badge>;
    case 'SOLD':
      return <Badge variant="emerald" size="sm">{isRtl ? 'فروخته‌شده' : 'Sold'}</Badge>;
    case 'RETURNED':
      return <Badge variant="warning" size="sm">{isRtl ? 'عودت‌شده' : 'Returned'}</Badge>;
    case 'EXPIRED':
      return <Badge variant="danger" size="sm">{isRtl ? 'منقضی' : 'Expired'}</Badge>;
    default:
      return <Badge variant="default" size="sm">{status}</Badge>;
  }
};

export const ConsignmentList: React.FC<ConsignmentListProps> = ({
  consignments = [],
  customers = [],
  currentUser,
  allUsers = [],
  sims = [],
  onRefresh,
}) => {
  const { t, isRtl } = useTranslation();
  const { success, error } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedCons, setSelectedCons] = useState<Consignment | null>(null);

  // Sale modal state
  const [sellCons, setSellCons] = useState<Consignment | null>(null);
  const [saleSellPrice, setSaleSellPrice] = useState('');
  const [saleBuyerId, setSaleBuyerId] = useState('');
  const [saleCommission, setSaleCommission] = useState('');
  const [salePayable, setSalePayable] = useState('');
  const [saleSettlement, setSaleSettlement] = useState<'PENDING' | 'PARTIAL' | 'SETTLED'>('PENDING');

  // Return modal state
  const [returnCons, setReturnCons] = useState<Consignment | null>(null);
  const [returnReason, setReturnReason] = useState('');

  // Contact modal state
  const [contactCons, setContactCons] = useState<Consignment | null>(null);
  const [contactType, setContactType] = useState<ConsignmentContact['type']>('CALL');
  const [contactSummary, setContactSummary] = useState('');

  const filtered = useMemo(() => {
    return (consignments || [])
      .filter((c) => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (c.simPhoneNumber || '').includes(q) ||
          (c.ownerCustomerName || '').toLowerCase().includes(q) ||
          (c.responsibleUserName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [consignments, statusFilter, searchQuery]);

  const activeCount = (consignments || []).filter((c) => c.status === 'CONSIGNMENT').length;
  const soldCount = (consignments || []).filter((c) => c.status === 'SOLD').length;

  const openSell = (c: Consignment) => {
    setSellCons(c);
    setSaleSellPrice(c.requestedPrice ? String(c.requestedPrice) : '');
    setSaleBuyerId('');
    setSaleCommission('');
    setSalePayable('');
    setSaleSettlement('PENDING');
  };

  const computeCommission = (cw: Consignment, salePrice: number, commissionAmountInput: string): { commission: number; payable: number } => {
    const input = Number(commissionAmountInput.replace(/,/g, '')) || 0;
    let commission = 0;
    if (cw.commissionType === 'PERCENTAGE') {
      commission = (salePrice * (cw.commissionValue || 0)) / 100;
      if (input > 0) commission = input; // manual override
    } else {
      commission = cw.commissionValue || 0;
      if (input > 0) commission = input;
    }
    return { commission: Math.round(commission), payable: Math.max(0, salePrice - commission) };
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellCons) return;
    if (!saleSellPrice) {
      error(isRtl ? 'لطفاً قیمت نهایی فروش را وارد کنید.' : 'Please enter final sale price.');
      return;
    }
    if (!saleBuyerId) {
      error(isRtl ? 'لطفاً خریدار را انتخاب کنید.' : 'Please select a buyer.');
      return;
    }
    const salePrice = Number(saleSellPrice.replace(/,/g, '')) || 0;
    const { commission, payable } = computeCommission(sellCons, salePrice, saleCommission);
    const buyer = customers.find((c) => c.id === saleBuyerId);

    try {
      const updated = await storage.sellConsignment(sellCons.id, {
        soldPrice: salePrice,
        actualCommission: commission,
        ownerPayableAmount: payable,
        buyerCustomerId: saleBuyerId,
        buyerCustomerName: buyer?.name || 'خریدار نامشخص',
        settlementStatus: saleSettlement,
      });

      // Update the SIM status to SOLD if not already
      const sim = sims.find((s) => s.id === sellCons.simId);
      if (sim && sim.status !== 'SOLD') {
        await storage.sellSimCard(sim.id, {
          customerId: saleBuyerId,
          customerName: buyer?.name || 'خریدار',
          contractId: `cnt-auto-${Date.now()}`,
          contractNumber: `CNT-${Date.now().toString().slice(-5)}`,
          salePrice,
          buyerMobile: buyer?.phone,
          buyerNationalId: buyer?.nationalId,
          deliveryMethod: 'OFFICE_PICKUP',
        });
        // restore consignment ownership marker on the sim
        await storage.saveSimCard({ ...sim, isConsigned: false, consignmentStatus: 'SOLD' });
      }

      storage.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'SELL_CONSIGNMENT',
        module: 'CONSIGNMENTS',
        entityType: 'CONSIGNMENT',
        entityName: `سیم‌کارت ${sellCons.simPhoneNumber}`,
        targetId: sellCons.id,
        details: `فروش امانی ${sellCons.simPhoneNumber} به مبلغ ${salePrice} - کمیسیون ${commission} - قابل پرداخت به مالک ${payable}`,
      });

      success(t('consignment.sellSuccess'));
      setSellCons(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'خطا در ثبت فروش امانی');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnCons) return;
    if (!returnReason.trim()) {
      error(isRtl ? 'لطفاً علت عودت را وارد کنید.' : 'Please enter return reason.');
      return;
    }
    try {
      const updated = await storage.returnConsignment(returnCons.id, returnReason.trim());
      const sim = sims.find((s) => s.id === returnCons.simId);
      if (sim) {
        await storage.saveSimCard({ ...sim, isConsigned: false, consignmentStatus: 'RETURNED', status: 'AVAILABLE' as any });
      }
      storage.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'RETURN_CONSIGNMENT',
        module: 'CONSIGNMENTS',
        entityType: 'CONSIGNMENT',
        entityName: `سیم‌کارت ${returnCons.simPhoneNumber}`,
        targetId: returnCons.id,
        details: `عودت امانی ${returnCons.simPhoneNumber} - علت: ${returnReason.trim()}`,
      });
      success(t('consignment.returnSuccess'));
      setReturnCons(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'خطا در ثبت عودت');
    }
  };

  const handleSettleSubmit = async (c: Consignment) => {
    try {
      await storage.settleConsignment(c.id);
      storage.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'SETTLE_CONSIGNMENT',
        module: 'CONSIGNMENTS',
        entityType: 'CONSIGNMENT',
        entityName: `سیم‌کارت ${c.simPhoneNumber}`,
        targetId: c.id,
        details: `تسویه کامل با مالک برای ${c.simPhoneNumber}`,
      });
      success(t('consignment.settleSuccess'));
      onRefresh();
    } catch (err: any) {
      error(err.message || 'خطا در تسویه');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactCons || !contactSummary.trim()) return;
    const contact: ConsignmentContact = {
      id: `cct-${Date.now()}`,
      date: new Date().toISOString(),
      type: contactType,
      summary: contactSummary.trim(),
      userId: currentUser.id,
      userName: currentUser.name,
    };
    await storage.addConsignmentContact(contactCons.id, contact);
    success(isRtl ? 'سابقه پیگیری ثبت شد' : 'Follow-up recorded');
    setContactSummary('');
    onRefresh();
  };

  const contactIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <PhoneCall className="w-3.5 h-3.5" />;
      case 'SMS': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'VISIT': return <Mail className="w-3.5 h-3.5" />;
      default: return <StickyNote className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Handshake className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>{t('consignment.title')}</span>
            </h1>
            <Badge variant="indigo" size="sm">
              <RTLNumber value={filtered.length} type="count" />
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('consignment.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
            {isRtl ? 'در جریان:' : 'Active:'} {activeCount}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
            {isRtl ? 'فروخته:' : 'Sold:'} {soldCount}
          </span>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {(['ALL', 'CONSIGNMENT', 'SOLD', 'RETURNED', 'EXPIRED'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {st === 'ALL' ? (isRtl ? 'همه' : 'All') :
                st === 'CONSIGNMENT' ? (isRtl ? 'در جریان' : 'Active') :
                st === 'SOLD' ? (isRtl ? 'فروخته' : 'Sold') :
                st === 'RETURNED' ? (isRtl ? 'عودت' : 'Returned') :
                (isRtl ? 'منقضی' : 'Expired')}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'جستجو در شماره سیم، مالک یا مسئول...' : 'Search SIM, owner or responsible...'}
              className="w-full text-xs px-9 py-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <Handshake className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('consignment.noConsignments')}</h3>
          <p className="text-xs text-slate-500">{t('consignment.noConsignmentsDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-end text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">سیم‌کارت</th>
                <th className="p-3">مالک</th>
                <th className="p-3">قیمت پیشنهادی</th>
                <th className="p-3">وضعیت</th>
                <th className="p-3">مسئول</th>
                <th className="p-3">دریافت</th>
                <th className="p-3 text-start">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono font-black text-indigo-700 dark:text-indigo-300 whitespace-nowrap" dir="ltr">
                    {c.simPhoneNumber}
                  </td>
                  <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {c.ownerCustomerName}
                  </td>
                  <td className="p-3 font-bold whitespace-nowrap">{formatToman(c.requestedPrice)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {statusBadge(c.status, isRtl)}
                    {c.status === 'SOLD' && c.settlementStatus === 'SETTLED' && (
                      <span className="ms-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">تسویه شده</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{c.responsibleUserName}</td>
                  <td className="p-3 whitespace-nowrap font-mono text-slate-500">
                    {formatPersianDate(c.receivedAt, false)}
                  </td>
                  <td className="p-3 text-start whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="xs" onClick={() => setSelectedCons(c)} leftIcon={<Eye className="w-3 h-3" />}>
                        جزئیات
                      </Button>
                      {c.status === 'CONSIGNMENT' && (
                        <>
                          <Button variant="success" size="xs" onClick={() => openSell(c)} leftIcon={<ShoppingCart className="w-3 h-3" />}>
                            {isRtl ? 'فروش' : 'Sell'}
                          </Button>
                          <Button variant="outline" size="xs" onClick={() => setReturnCons(c)} leftIcon={<Undo2 className="w-3 h-3 text-amber-500" />}>
                            {isRtl ? 'عودت' : 'Return'}
                          </Button>
                          <Button variant="outline" size="xs" onClick={() => setContactCons(c)} leftIcon={<History className="w-3 h-3 text-indigo-500" />}>
                            پیگیری
                          </Button>
                        </>
                      )}
                      {c.status === 'SOLD' && c.settlementStatus !== 'SETTLED' && (
                        <Button variant="outline" size="xs" onClick={() => handleSettleSubmit(c)} leftIcon={<Wallet className="w-3 h-3 text-emerald-500" />}>
                          {isRtl ? 'تسویه' : 'Settle'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCons && (
        <Modal
          isOpen={Boolean(selectedCons)}
          onClose={() => setSelectedCons(null)}
          size="lg"
          title={`${isRtl ? 'جزئیات امانی سیم‌کارت' : 'Consignment details'} ${selectedCons.simPhoneNumber}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400">{t('consignment.owner')}</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedCons.ownerCustomerName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400">{t('consignment.requestedPrice')}</p>
                <p className="text-xs font-bold">{formatToman(selectedCons.requestedPrice)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400">{t('consignment.status')}</p>
                <p>{statusBadge(selectedCons.status, isRtl)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400">{t('consignment.responsible')}</p>
                <p className="text-xs font-bold">{selectedCons.responsibleUserName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400">{t('consignment.receivedAt')}</p>
                <p className="text-xs font-bold">{formatPersianDate(selectedCons.receivedAt, false)}</p>
              </div>
              {selectedCons.expiryAt && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-400">{t('consignment.expiryAt')}</p>
                  <p className="text-xs font-bold">{formatPersianDate(selectedCons.expiryAt, false)}</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="text-[10px] text-slate-400">{t('consignment.agreedTerms')}</p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{selectedCons.agreedTerms || '—'}</p>
            </div>

            {selectedCons.status === 'SOLD' && (
              <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/30 border border-emerald-500/20 space-y-2">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShoppingCart className="w-4 h-4" /> {t('consignment.sellAction')}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400">{t('consignment.soldPrice')}</p>
                    <p className="font-bold">{formatToman(selectedCons.soldPrice || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400">{t('consignment.actualCommission')}</p>
                    <p className="font-bold">{formatToman(selectedCons.actualCommission || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400">{t('consignment.ownerPayable')}</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatToman(selectedCons.ownerPayableAmount || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400">{t('consignment.buyer')}</p>
                    <p className="font-bold">{selectedCons.buyerCustomerName || '—'}</p>
                  </div>
                  <div className="space-y-0.5 col-span-2">
                    <p className="text-[10px] text-slate-400">{t('consignment.settlementStatus')}</p>
                    <p className="font-bold">
                      {selectedCons.settlementStatus === 'SETTLED'
                        ? (isRtl ? 'تسویه کامل' : 'Settled')
                        : selectedCons.settlementStatus === 'PARTIAL'
                        ? (isRtl ? 'تسویه جزئی' : 'Partial')
                        : (isRtl ? 'در انتظار' : 'Pending')}
                      {selectedCons.settledAt && ` — ${formatPersianDate(selectedCons.settledAt, false)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedCons.status === 'RETURNED' && (
              <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-950/30 border border-amber-500/20 space-y-1.5">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Undo2 className="w-4 h-4" /> {t('consignment.returnReason')}
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300">{selectedCons.returnReason || '—'}</p>
                {selectedCons.returnedAt && (
                  <p className="text-[10px] font-mono text-slate-400">{formatPersianDate(selectedCons.returnedAt, true)}</p>
                )}
              </div>
            )}

            {selectedCons.contactHistory && selectedCons.contactHistory.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <History className="w-4 h-4 text-indigo-500" /> {t('consignment.contactHistory')}
                </h4>
                {selectedCons.contactHistory.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">{contactIcon(h.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 dark:text-slate-300">{h.summary}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {h.userName} — {formatPersianDate(h.date, true)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCons(null)}>
                {isRtl ? 'بستن' : 'Close'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sell Modal */}
      {sellCons && (
        <Modal
          isOpen={Boolean(sellCons)}
          onClose={() => setSellCons(null)}
          title={`${isRtl ? 'ثبت فروش امانی' : 'Consignment sale'}: ${sellCons.simPhoneNumber}`}
        >
          <form onSubmit={handleSellSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t('consignment.soldPrice')}
                value={saleSellPrice}
                onChange={(e) => {
                  setSaleSellPrice(e.target.value);
                  const p = Number(e.target.value.replace(/,/g, '')) || 0;
                  const { commission, payable } = computeCommission(sellCons, p, saleCommission);
                  setSaleCommission(String(commission));
                  setSalePayable(String(payable));
                }}
                isRequired
              />
              <Select
                label={t('consignment.buyer')}
                value={saleBuyerId}
                onChange={(e) => setSaleBuyerId(e.target.value)}
                isRequired
              >
                <option value="">-- انتخاب خریدار --</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || ''})</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={`${t('consignment.actualCommission')} (${sellCons.commissionType === 'PERCENTAGE' ? `${sellCons.commissionValue}%` : 'تومان'})`}
                value={saleCommission}
                onChange={(e) => {
                  setSaleCommission(e.target.value);
                  const p = Number(saleSellPrice.replace(/,/g, '')) || 0;
                  const { payable } = computeCommission(sellCons, p, e.target.value);
                  setSalePayable(String(payable));
                }}
                isRequired
              />
              <Input
                label={t('consignment.ownerPayable')}
                value={salePayable}
                onChange={(e) => setSalePayable(e.target.value)}
                isRequired
              />
            </div>

            <Select
              label={t('consignment.settlementStatus')}
              value={saleSettlement}
              onChange={(e) => setSaleSettlement(e.target.value as any)}
            >
              <option value="PENDING">{isRtl ? 'در انتظار تسویه' : 'Pending settlement'}</option>
              <option value="PARTIAL">{isRtl ? 'تسویه جزئی' : 'Partial settlement'}</option>
              <option value="SETTLED">{isRtl ? 'تسویه کامل' : 'Fully settled'}</option>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setSellCons(null)}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button variant="success" size="sm" type="submit" leftIcon={<ShoppingCart className="w-4 h-4" />}>
                {t('consignment.sellAction')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Modal */}
      {returnCons && (
        <Modal
          isOpen={Boolean(returnCons)}
          onClose={() => setReturnCons(null)}
          title={`${isRtl ? 'عودت امانی' : 'Consignment return'}: ${returnCons.simPhoneNumber}`}
        >
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              {isRtl
                ? `سیم‌کارت ${returnCons.simPhoneNumber} به مالک ${returnCons.ownerCustomerName} عودت داده می‌شود و از حالت امانی خارج می‌گردد.`
                : `SIM ${returnCons.simPhoneNumber} will be returned to owner ${returnCons.ownerCustomerName} and removed from consignment.`}
            </div>
            <Textarea
              label={t('consignment.returnReason')}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={2}
              isRequired
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setReturnCons(null)}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button variant="danger" size="sm" type="submit" leftIcon={<Undo2 className="w-4 h-4" />}>
                {t('consignment.returnAction')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Contact / Follow-up Modal */}
      {contactCons && (
        <Modal
          isOpen={Boolean(contactCons)}
          onClose={() => setContactCons(null)}
          title={`${isRtl ? 'ثبت پیگیری' : 'Record follow-up'}: ${contactCons.simPhoneNumber}`}
        >
          <form onSubmit={handleAddContact} className="space-y-4">
            <Select
              label={isRtl ? 'نوع پیگیری' : 'Follow-up type'}
              value={contactType}
              onChange={(e) => setContactType(e.target.value as any)}
            >
              <option value="CALL">{isRtl ? 'تماس تلفنی' : 'Phone call'}</option>
              <option value="SMS">{isRtl ? 'پیامک' : 'SMS'}</option>
              <option value="VISIT">{isRtl ? 'مراجعه حضوری' : 'In-person visit'}</option>
              <option value="NOTE">{isRtl ? 'یادداشت' : 'Note'}</option>
            </Select>
            <Textarea
              label={isRtl ? 'خلاصه پیگیری' : 'Follow-up summary'}
              value={contactSummary}
              onChange={(e) => setContactSummary(e.target.value)}
              rows={2}
              isRequired
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setContactCons(null)}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button variant="primary" size="sm" type="submit" leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                {isRtl ? 'ثبت' : 'Save'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};