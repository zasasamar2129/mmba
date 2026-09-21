import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Lead, Customer, CustomerStatus, CustomerType } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { storage } from '../../services/storage';
import { UserCheck, Sparkles, Building2, Phone, User, Check, ArrowRight } from 'lucide-react';

export interface LeadConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onConverted: (customer: Customer) => void;
}

export const LeadConvertModal: React.FC<LeadConvertModalProps> = ({
  isOpen,
  onClose,
  lead,
  onConverted,
}) => {
  const { success, error } = useToast();
  const { isRtl } = useTranslation();
  const [name, setName] = useState(lead?.name || '');
  const [companyName, setCompanyName] = useState(lead?.company || '');
  const [mobile, setMobile] = useState(lead?.mobile || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<CustomerType>(CustomerType.INDIVIDUAL);
  const [notes, setNotes] = useState(lead?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (lead) {
      setName(lead.name || '');
      setCompanyName(lead.company || '');
      setMobile(lead.mobile || '');
      setNotes(lead.notes ? `[تبدیل شده از سرنخ ${lead.leadCode}]\n${lead.notes}` : `[تبدیل شده از سرنخ ${lead.leadCode}]`);
    }
  }, [lead]);

  if (!lead) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error(isRtl ? 'لطفاً نام مشتری را وارد کنید' : 'Please enter the customer name');
      return;
    }
    if (!mobile.trim()) {
      error(isRtl ? 'شماره موبایل الزامی است' : 'Mobile number is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const customerData: Partial<Customer> = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        mobile: mobile.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        type,
        status: CustomerStatus.ACTIVE,
        notes: notes.trim(),
        source: lead.source || (isRtl ? 'تبدیل سرنخ ورودی' : 'Incoming Lead Conversion'),
      };

      const result = await storage.convertLeadToCustomer(lead.id, customerData);
      success(`سرنخ «${lead.leadCode}» با موفقیت به مشتری «${result.customer.name}» تبدیل گردید و پرونده دائمی ایجاد شد.`);
      onConverted(result.customer);
      onClose();
    } catch (err: any) {
      console.error(err);
      error(err.message || (isRtl ? 'خطا در تبدیل سرنخ به مشتری' : 'Error converting lead to customer'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">{isRtl ? 'تبدیل سرنخ به پرونده مشتری دائمی' : 'Convert Lead to Permanent Customer'}</h3>
            <p className="text-xs text-slate-500 font-normal">
              کد سرنخ: {lead.leadCode} ({lead.mobile})
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleConvert} className="space-y-4 text-end">
        {/* Info Banner */}
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            حفظ کلیه تاریخچه و تعاملات بدون ایجاد مخاطب تکراری
          </p>
          <p className="text-[11px] leading-relaxed opacity-90">
            با تکمیل اطلاعات، تمام سوابق تماس‌ها، مذاکرات صوتی و وظایف پیگیری به صورت خودکار به پرونده مشتری جدید متصل خواهند شد.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label={isRtl ? 'نام و نام خانوادگی مشتری *' : 'Customer Full Name *'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isRtl ? 'مثال: مهندس علی رضایی' : 'e.g. Eng. Ali Rezaei'}
            isRequired
            autoFocus
          />

          <Input
            label={isRtl ? 'نام شرکت / سازمان (اختیاری)' : 'Company / Organization (optional)'}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={isRtl ? 'مثال: شرکت بازرگانی پارس' : 'e.g. Pars Trading Company'}
          />

          <Input
            label={isRtl ? 'شماره موبایل اصلی *' : 'Primary Mobile *'}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="0912xxxxxxx"
            isRequired
            dir="ltr"
          />

          <Input
            label={isRtl ? 'تلفن ثابت (اختیاری)' : 'Landline (optional)'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="021xxxxxxxx"
            dir="ltr"
          />

          <Select
            label={isRtl ? 'نوع مشتری' : 'Customer Type'}
            value={type}
            onChange={(e) => setType(e.target.value as CustomerType)}
            options={[
              { value: CustomerType.INDIVIDUAL, label: isRtl ? 'حقیقی (شخصی)' : 'Individual' },
              { value: CustomerType.CORPORATE, label: isRtl ? 'حقوقی (شرکتی/سازمانی)' : 'Corporate' },
            ]}
          />

          <Input
            label={isRtl ? 'شهر' : 'City'}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={isRtl ? 'تهران' : 'Tehran'}
          />
        </div>

        <Textarea
          label={isRtl ? 'یادداشت‌ها و توافقات اولیه' : 'Notes & Initial Agreements'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={isRtl ? 'سوابق نیازها، شرایط تخفیف یا یادداشت‌های کارشناسی...' : 'Needs history, discount terms, or expert notes...'}
        />

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </Button>
          <Button
            variant="success"
            size="sm"
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<UserCheck className="w-4 h-4" />}
          >
            تایید و صدور پرونده مشتری
          </Button>
        </div>
      </form>
    </Modal>
  );
};
