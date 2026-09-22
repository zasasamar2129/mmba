import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Customer, CustomerStatus } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import {
  User, Phone, Building2, MapPin, Tag, Check, Hash, RotateCcw,
  AlertTriangle, ExternalLink, Edit3, UserCheck, ShieldAlert
} from 'lucide-react';
import { normalizePhoneNumber } from '../../lib/numberUtils';
import { useTranslation } from '../../lib/i18n';

export interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
  onSaved: (customer: Customer) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  customerToEdit: externalCustomerToEdit,
  onSaved,
  onSelectCustomer,
}) => {
  const { success, error, warning } = useToast();
  const { t, isRtl } = useTranslation();

  const [activeEditingCustomer, setActiveEditingCustomer] = useState<Customer | null>(externalCustomerToEdit || null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [registrationReason, setRegistrationReason] = useState(isRtl ? 'مشتری' : 'Customer');
  const [registrationReasonOther, setRegistrationReasonOther] = useState('');
  const [city, setCity] = useState(isRtl ? 'تهران' : 'Tehran');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<CustomerStatus>(CustomerStatus.ACTIVE);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState<string>('0');
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const draftKey = activeEditingCustomer ? `draft_cust_${activeEditingCustomer.id}` : 'draft_cust_new';
  const isInitialMount = useRef(true);

  // Sync external customerToEdit
  useEffect(() => {
    setActiveEditingCustomer(externalCustomerToEdit || null);
  }, [externalCustomerToEdit, isOpen]);

  // Initialize or restore draft when modal opens or active editing customer changes
  useEffect(() => {
    if (!isOpen) {
      setHasRestoredDraft(false);
      isInitialMount.current = true;
      return;
    }

    isInitialMount.current = true;
    const savedDraft = storage.getDraft(draftKey);

    if (activeEditingCustomer) {
      if (savedDraft) {
        setName(savedDraft.name ?? activeEditingCustomer.name ?? '');
        setMobile(savedDraft.mobile ?? activeEditingCustomer.mobile ?? '');
        setPhone(savedDraft.phone ?? activeEditingCustomer.phone ?? '');
        setNationalCode(savedDraft.nationalCode ?? activeEditingCustomer.nationalCode ?? '');
        setEmail(savedDraft.email ?? activeEditingCustomer.email ?? '');
        setCompanyName(savedDraft.companyName ?? activeEditingCustomer.companyName ?? '');
        setJobTitle(savedDraft.jobTitle ?? activeEditingCustomer.jobTitle ?? '');
        setRegistrationReason(savedDraft.registrationReason ?? activeEditingCustomer.registrationReason ?? (isRtl ? 'مشتری' : 'Customer'));
        setRegistrationReasonOther(savedDraft.registrationReasonOther ?? activeEditingCustomer.registrationReasonOther ?? '');
        setCity(savedDraft.city ?? activeEditingCustomer.city ?? (isRtl ? 'تهران' : 'Tehran'));
        setAddress(savedDraft.address ?? activeEditingCustomer.address ?? '');
        setStatus(savedDraft.status ?? activeEditingCustomer.status ?? CustomerStatus.ACTIVE);
        setTags(savedDraft.tags ?? activeEditingCustomer.tags ?? []);
        setNotes(savedDraft.notes ?? activeEditingCustomer.notes ?? '');
        setCreditLimit(String(savedDraft.creditLimit ?? activeEditingCustomer.creditLimit ?? 0));
        setHasRestoredDraft(true);
      } else {
        setName(activeEditingCustomer.name || '');
        setMobile(activeEditingCustomer.mobile || '');
        setPhone(activeEditingCustomer.phone || '');
        setNationalCode(activeEditingCustomer.nationalCode || '');
        setEmail(activeEditingCustomer.email || '');
        setCompanyName(activeEditingCustomer.companyName || '');
        setJobTitle(activeEditingCustomer.jobTitle || '');
        setRegistrationReason(activeEditingCustomer.registrationReason || (isRtl ? 'مشتری' : 'Customer'));
        setRegistrationReasonOther(activeEditingCustomer.registrationReasonOther || '');
        setCity(activeEditingCustomer.city || (isRtl ? 'تهران' : 'Tehran'));
        setAddress(activeEditingCustomer.address || '');
        setStatus(activeEditingCustomer.status ? (activeEditingCustomer.status as CustomerStatus) : CustomerStatus.ACTIVE);
        setTags(activeEditingCustomer.tags || []);
        setNotes(activeEditingCustomer.notes || '');
        setCreditLimit(String(activeEditingCustomer.creditLimit || 0));
        setHasRestoredDraft(false);
      }
    } else {
      if (savedDraft && (savedDraft.name || savedDraft.mobile || savedDraft.companyName || savedDraft.notes)) {
        setName(savedDraft.name || '');
        setMobile(savedDraft.mobile || '');
        setPhone(savedDraft.phone || '');
        setNationalCode(savedDraft.nationalCode || '');
        setEmail(savedDraft.email || '');
        setCompanyName(savedDraft.companyName || '');
        setJobTitle(savedDraft.jobTitle || '');
        setRegistrationReason(savedDraft.registrationReason || (isRtl ? 'مشتری' : 'Customer'));
        setRegistrationReasonOther(savedDraft.registrationReasonOther || '');
        setCity(savedDraft.city || (isRtl ? 'تهران' : 'Tehran'));
        setAddress(savedDraft.address || '');
        setStatus(savedDraft.status || CustomerStatus.ACTIVE);
        setTags(savedDraft.tags || (isRtl ? ['مشتری جدید'] : ['New customer']));
        setNotes(savedDraft.notes || '');
        setCreditLimit(String(savedDraft.creditLimit || 0));
        setHasRestoredDraft(true);
      } else {
        setName('');
        setMobile('');
        setPhone('');
        setNationalCode('');
        setEmail('');
        setCompanyName('');
        setJobTitle('');
        setRegistrationReason(isRtl ? 'مشتری' : 'Customer');
        setRegistrationReasonOther('');
        setCity(isRtl ? 'تهران' : 'Tehran');
        setAddress('');
        setStatus(CustomerStatus.ACTIVE);
        setTags(isRtl ? ['مشتری جدید'] : ['New customer']);
        setNotes('');
        setCreditLimit('0');
        setHasRestoredDraft(false);
      }
    }

    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [activeEditingCustomer, isOpen, draftKey]);

  // Auto-save form draft to localStorage on field changes
  useEffect(() => {
    if (!isOpen || isInitialMount.current) return;

    const hasContent = !!(name || mobile || phone || nationalCode || email || companyName || address || notes || (creditLimit && creditLimit !== '0'));

    if (hasContent) {
      const handler = setTimeout(() => {
        storage.saveDraft(draftKey, {
          name,
          mobile,
          phone,
          nationalCode,
          email,
          companyName,
          jobTitle,
          registrationReason,
          registrationReasonOther,
          city,
          address,
          status,
          tags,
          notes,
          creditLimit,
        });
      }, 300);

      return () => clearTimeout(handler);
    }
  }, [name, mobile, phone, nationalCode, email, companyName, jobTitle, registrationReason, registrationReasonOther, city, address, status, tags, notes, creditLimit, isOpen, draftKey]);

  // Real-time duplicate phone number detection (checking both mobile and landline)
  const duplicateConflict = useMemo(() => {
    if (!isOpen) return null;
    const currentEditingId = activeEditingCustomer?.id;

    if (mobile && mobile.trim().length >= 8) {
      const existing = storage.findCustomerByPhone(mobile, currentEditingId);
      if (existing) {
        return {
          existingContact: existing,
          type: 'mobile' as const,
          number: mobile,
        };
      }
    }

    if (phone && phone.trim().length >= 7) {
      const existing = storage.findCustomerByPhone(phone, currentEditingId);
      if (existing) {
        return {
          existingContact: existing,
          type: 'phone' as const,
          number: phone,
        };
      }
    }

    return null;
  }, [mobile, phone, activeEditingCustomer, isOpen]);

  // Direct action to switch to editing the existing contact
  const handleSwitchToExisting = (existing: Customer) => {
    storage.clearDraft(draftKey);
    setActiveEditingCustomer(existing);
    setName(existing.name || '');
    setMobile(existing.mobile || '');
    setPhone(existing.phone || '');
    setNationalCode(existing.nationalCode || '');
    setEmail(existing.email || '');
    setCompanyName(existing.companyName || '');
    setCity(existing.city || (isRtl ? 'تهران' : 'Tehran'));
    setAddress(existing.address || '');
    setStatus(existing.status ? (existing.status as CustomerStatus) : CustomerStatus.ACTIVE);
    setTags(existing.tags || []);
    setNotes(existing.notes || '');
    setCreditLimit(String(existing.creditLimit || 0));
    setHasRestoredDraft(false);

    warning(isRtl ? `فرم به پرونده مخاطب «${existing.name}» تغییر یافت.` : `Form changed to customer profile "${existing.name}".`);
  };

  const handleClearDraft = () => {
    storage.clearDraft(draftKey);
    setHasRestoredDraft(false);

    if (activeEditingCustomer) {
      setName(activeEditingCustomer.name || '');
      setMobile(activeEditingCustomer.mobile || '');
      setPhone(activeEditingCustomer.phone || '');
      setNationalCode(activeEditingCustomer.nationalCode || '');
      setEmail(activeEditingCustomer.email || '');
      setCompanyName(activeEditingCustomer.companyName || '');
      setCity(activeEditingCustomer.city || (isRtl ? 'تهران' : 'Tehran'));
      setAddress(activeEditingCustomer.address || '');
      setStatus(activeEditingCustomer.status ? (activeEditingCustomer.status as CustomerStatus) : CustomerStatus.ACTIVE);
      setTags(activeEditingCustomer.tags || []);
      setNotes(activeEditingCustomer.notes || '');
      setCreditLimit(String(activeEditingCustomer.creditLimit || 0));
    } else {
      setName('');
      setMobile('');
      setPhone('');
      setNationalCode('');
      setEmail('');
      setCompanyName('');
      setCity(isRtl ? 'تهران' : 'Tehran');
      setAddress('');
      setStatus(CustomerStatus.ACTIVE);
      setTags(['مشتری جدید']);
      setNotes('');
      setCreditLimit('0');
    }
    success(isRtl ? 'پیش‌نویس پاک شد و فرم بازنشانی گردید' : 'Draft cleared and form reset');
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error(isRtl ? 'لطفاً نام و نام خانوادگی مخاطب را وارد کنید' : 'Please enter the customer name');
      return;
    }
    if (!mobile.trim()) {
      error(isRtl ? 'لطفاً شماره موبایل را وارد کنید' : 'Please enter the mobile number');
      return;
    }

    // UI Level duplicate validation check
    if (duplicateConflict) {
      error(isRtl ? `این شماره (${duplicateConflict.number}) از قبل برای مخاطب «${duplicateConflict.existingContact.name}» ثبت شده است.` : `This number (${duplicateConflict.number}) is already registered for "${duplicateConflict.existingContact.name}".`);
      return;
    }

    const payload: Customer = {
      id: activeEditingCustomer?.id || '',
      code: activeEditingCustomer?.code || '',
      name: name.trim(),
      mobile: mobile.trim(),
      phone: phone.trim(),
      nationalCode: nationalCode.trim(),
      email: email.trim(),
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      registrationReason: registrationReason.trim(),
      registrationReasonOther: registrationReason === 'سایر' ? registrationReasonOther.trim() : undefined,
      city: city.trim(),
      address: address.trim(),
      status,
      tags,
      notes: notes.trim(),
      creditLimit: Number(creditLimit) || 0,
      assignedUserId: activeEditingCustomer?.assignedUserId || storage.getCurrentUser().id,
      createdAt: activeEditingCustomer?.createdAt || '',
      updatedAt: '',
    };

    try {
      // Backend / Storage level validation
      const saved = storage.saveCustomer(payload);
      storage.clearDraft(draftKey);
      setHasRestoredDraft(false);

      success(activeEditingCustomer ? (isRtl ? 'اطلاعات مخاطب با موفقیت به‌روزرسانی شد' : 'Customer updated successfully') : (isRtl ? 'پرونده مخاطب جدید با موفقیت ثبت شد' : 'New customer profile created successfully'));
      onSaved(saved);
      onClose();
    } catch (err: any) {
      if (err?.code === 'DUPLICATE_PHONE' && err?.existingCustomer) {
        error(err.message || (isRtl ? 'این شماره از قبل در سیستم ثبت شده است.' : 'This number is already registered.'));
      } else {
        error(err?.message || (isRtl ? 'خطا در ثبت اطلاعات مخاطب' : 'Error saving customer data'));
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <span>{activeEditingCustomer ? (isRtl ? `ویرایش پرونده: ${activeEditingCustomer.name}` : `Edit Profile: ${activeEditingCustomer.name}`) : (isRtl ? 'ثبت مخاطب / مشتری جدید' : 'New Customer / Contact')}</span>
        </div>
      }
      subtitle={isRtl ? 'تکمیل اطلاعات هویتی، تماس، یکتا بودن شماره، اعتبار مالی و دسته‌بندی' : 'Complete identity, contact, unique number, financial credit and category information'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Duplicate Conflict Banner */}
        {duplicateConflict && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs animate-fadeIn space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-sm text-rose-300">
                  {isRtl ? 'این شماره از قبل در سیستم ثبت شده است. آیا مایلید مخاطب موجود را ویرایش کنید؟' : 'This number already exists. Would you like to edit the existing contact?'}
                </div>
                <div className="text-slate-300 text-xs">
                  {isRtl ? 'شماره' : 'Number'} <span className="font-mono font-bold text-rose-200" dir="ltr">{duplicateConflict.number}</span> {isRtl ? 'به نام' : 'belongs to'}{' '}
                  <strong className="text-white font-bold underline">{duplicateConflict.existingContact.name}</strong> ({isRtl ? 'کد پرونده' : 'Record code'}: {duplicateConflict.existingContact.code}) {isRtl ? 'در دیتابیس موجود است.' : 'already exists in the database.'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                onClick={() => {
                  if (onSelectCustomer) {
                    onSelectCustomer(duplicateConflict.existingContact);
                    onClose();
                  } else {
                    handleSwitchToExisting(duplicateConflict.existingContact);
                  }
                }}
                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                مشاهده پرونده مخاطب موجود
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                onClick={() => handleSwitchToExisting(duplicateConflict.existingContact)}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                ویرایش همین مخاطب موجود
              </Button>
            </div>
          </div>
        )}

        {hasRestoredDraft && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-fadeIn">
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{isRtl ? 'پیش‌نویس ذخیره‌شده خودکار شما بارگذاری شد.' : 'Your auto-saved draft has been restored.'}</span>
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-amber-300 hover:text-white underline font-semibold px-2 py-1 rounded hover:bg-amber-500/20 transition-colors shrink-0"
            >
              پاک کردن پیش‌نویس
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input
            label={isRtl ? 'نام و نام خانوادگی / عنوان مخاطب' : 'Full Name / Contact Title'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            isRequired
            placeholder={isRtl ? 'مثال: علی رضایی' : 'e.g. Ali Rezaei'}
            rightIcon={<User className="w-4 h-4" />}
          />

          <div>
            <Input
              label={isRtl ? 'شماره موبایل (یکتا)' : 'Mobile Number (Unique)'}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              isRequired
              placeholder="0912..."
              rightIcon={<Phone className="w-4 h-4" />}
              className={duplicateConflict && duplicateConflict.type === 'mobile' ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30' : ''}
            />
            {duplicateConflict && duplicateConflict.type === 'mobile' && (
              <span className="text-[11px] text-rose-400 mt-1 block font-medium">
                تکراری: متعلق به {duplicateConflict.existingContact.name}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <Input
              label={isRtl ? 'تلفن ثابت / دفتر' : 'Landline / Office'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="021..."
              className={duplicateConflict && duplicateConflict.type === 'phone' ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30' : ''}
            />
            {duplicateConflict && duplicateConflict.type === 'phone' && (
              <span className="text-[11px] text-rose-400 mt-1 block font-medium">
                تکراری: متعلق به {duplicateConflict.existingContact.name}
              </span>
            )}
          </div>

          <Input
            label={isRtl ? 'کد ملی / شناسه ملی' : 'National ID'}
            value={nationalCode}
            onChange={(e) => setNationalCode(e.target.value)}
            placeholder={isRtl ? '۱۰ رقمی...' : '10 digits...'}
            rightIcon={<Hash className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input
            label={isRtl ? 'پست الکترونیک (ایمیل)' : 'Email Address'}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
          />

          <Input
            label={isRtl ? 'نام شرکت / سازمان / فروشگاه' : 'Company / Organization Name'}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={isRtl ? 'مثال: بازرگانی نوین' : 'e.g. Novin Trading'}
            rightIcon={<Building2 className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input
            label={isRtl ? 'سمت یا عنوان شغلی' : 'Job Title / Position'}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder={isRtl ? 'مثال: مدیر فروش / کارشناس تدارکات' : 'e.g. Sales Manager / Procurement'}
          />

          <div>
            <Select
              label={isRtl ? 'دلیل ثبت مخاطب در سامانه' : 'Registration Reason'}
              value={registrationReason}
              onChange={(e) => setRegistrationReason(e.target.value)}
              options={[
                { value: 'مشتری', label: isRtl ? 'مشتری' : 'Customer' },
                { value: 'مشتری بالقوه', label: isRtl ? 'مشتری بالقوه' : 'Prospect' },
                { value: 'همکار', label: isRtl ? 'همکار' : 'Colleague' },
                { value: 'تأمین‌کننده', label: isRtl ? 'تأمین‌کننده' : 'Supplier' },
                { value: 'دوست/آشنا', label: isRtl ? 'دوست / آشنا' : 'Friend / Acquaintance' },
                { value: 'تماس کاری', label: isRtl ? 'تماس کاری' : 'Work Contact' },
                { value: 'پیگیری فروش', label: isRtl ? 'پیگیری فروش' : 'Sales Follow-up' },
                { value: 'سایر', label: isRtl ? 'سایر (توضیح دلخواه)' : 'Other (custom note)' },
              ]}
            />
            {registrationReason === 'سایر' && (
              <Input
                placeholder={isRtl ? 'توضیح دلیل ثبت...' : 'Explain the reason...'}
                value={registrationReasonOther}
                onChange={(e) => setRegistrationReasonOther(e.target.value)}
                className="mt-2 text-xs"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Input
            label={isRtl ? 'شهر' : 'City'}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={isRtl ? 'تهران' : 'Tehran'}
            rightIcon={<MapPin className="w-4 h-4" />}
          />

          <Select
            label={isRtl ? 'وضعیت پرونده' : 'Record Status'}
            value={status}
            onChange={(e) => setStatus(e.target.value as CustomerStatus)}
            options={[
              { value: CustomerStatus.ACTIVE, label: isRtl ? 'فعال' : 'Active' },
              { value: CustomerStatus.PROSPECT, label: isRtl ? 'مشتری بالقوه / سرنخ' : 'Prospect / Lead' },
              { value: CustomerStatus.VIP, label: isRtl ? 'ویژه (VIP)' : 'VIP' },
              { value: CustomerStatus.INACTIVE, label: isRtl ? 'غیرفعال' : 'Inactive' },
              { value: CustomerStatus.BLACKLISTED, label: isRtl ? 'مسدود / لیست سیاه' : 'Blacklisted' },
            ]}
          />

          <Input
            label={isRtl ? 'سقف اعتبار مالی (تومان)' : 'Credit Limit (Toman)'}
            type="number"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="0"
          />
        </div>

        <Input
          label={isRtl ? 'آدرس پستی دقیق' : 'Full Postal Address'}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={isRtl ? 'خیابان، پلاک، طبقه، واحد...' : 'Street, number, floor, unit...'}
        />

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'برچسب‌ها و گروه‌بندی' : 'Tags & Grouping'}</label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder={isRtl ? 'برچسب جدید (Enter بزنید)' : 'New tag (press Enter)'}
              rightIcon={<Tag className="w-4 h-4" />}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddTag}>
              افزودن
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-bold ms-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Notes with Voice Input */}
        <Textarea
          label={isRtl ? 'یادداشت‌های پرونده مخاطب' : 'Customer Notes'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isRtl ? 'سوابق، ترجیحات مشتری، نکات کلیدی و الزامات ارتباطی...' : 'History, customer preferences, key notes and communication requirements...'}
          actionButton={
            <VoiceInputButton
              onTranscript={(transcript) => {
                setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
            />
          }
        />

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            {activeEditingCustomer && (
              <span className="text-xs text-slate-400 font-mono">
                شناسه سیستم: {activeEditingCustomer.code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!!duplicateConflict}
              leftIcon={<Check className="w-4 h-4" />}
              className={duplicateConflict ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {activeEditingCustomer ? (isRtl ? 'ذخیره تغییرات پرونده' : 'Save Profile Changes') : (isRtl ? 'ایجاد پرونده مخاطب' : 'Create Customer Record')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
