import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RegisteredHolder, SimCard, User, UserRole } from '../../types';
import { storage, subscribeToStorage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { RTLNumber } from '../ui/RTLNumber';
import {
  Users, UserPlus, Search, ShieldAlert, CheckCircle2,
  AlertTriangle, Phone, CreditCard, Trash2, Edit2, FileText,
  Smartphone, Lock, Upload, Download, Share2, Eye, Image as ImageIcon,
  Check, Copy, Printer, ExternalLink, X, RefreshCw, Loader2
} from 'lucide-react';
import { idbStorage } from '../../lib/idbStorage';
import { compressIdCardImage } from '../../lib/imageCompressor';

export interface RegisteredHoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectHolderForFilter?: (holderId: string, holderName: string) => void;
}

// Persian / Arabic digits normalizer
const normalizePersianNumbers = (val: string): string => {
  if (!val) return '';
  return val
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

const cleanDigits = (val: string): string => {
  return normalizePersianNumbers(val).replace(/[^0-9]/g, '');
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const RegisteredHoldersModal: React.FC<RegisteredHoldersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectHolderForFilter,
}) => {
  const { success, error, info } = useToast();
  const { t, isRtl } = useTranslation();
  const [holders, setHolders] = useState<RegisteredHolder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingOrEditing, setIsAddingOrEditing] = useState(false);
  const [editingHolder, setEditingHolder] = useState<RegisteredHolder | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [mobile, setMobile] = useState('');
  const [shebaNumber, setShebaNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ fullName?: string; nationalId?: string; mobile?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ID Card document upload state
  const [idCardFile, setIdCardFile] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [quickUploadTargetHolder, setQuickUploadTargetHolder] = useState<RegisteredHolder | null>(null);
  const quickUploadTargetHolderRef = useRef<RegisteredHolder | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // ID Card Viewer & Share Modal state
  const [viewingHolder, setViewingHolder] = useState<RegisteredHolder | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Delete modal
  const [deletingHolder, setDeletingHolder] = useState<RegisteredHolder | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isManager = useMemo(() => {
    if (!currentUser) return false;
    const allowed = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GOD, 'ADMIN'];
    return allowed.includes(currentUser.role) || (currentUser.role as string) === 'SUPER_ADMIN';
  }, [currentUser]);

  const loadData = () => {
    const list = storage.getRegisteredHolders();
    setHolders(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      return subscribeToStorage((event) => {
        if (event.key === 'REGISTERED_HOLDERS' || event.key === 'SIMS' || event.key === 'ALL') {
          loadData();
        }
      });
    }
  }, [isOpen]);

  const filteredHolders = useMemo(() => {
    if (!searchQuery.trim()) return holders;
    const q = searchQuery.toLowerCase().trim();
    return holders.filter(
      (h) =>
        h.fullName.toLowerCase().includes(q) ||
        h.nationalId.includes(q) ||
        h.mobile.includes(q) ||
        (h.notes && h.notes.toLowerCase().includes(q))
    );
  }, [holders, searchQuery]);

  const handleOpenCreate = () => {
    setEditingHolder(null);
    setFullName('');
    setNationalId('');
    setMobile('');
    setShebaNumber('');
    setNotes('');
    setIdCardFile(null);
    setFormErrors({});
    setIsAddingOrEditing(true);
  };

  const handleOpenEdit = (h: RegisteredHolder) => {
    setEditingHolder(h);
    setFullName(h.fullName);
    setNationalId(h.nationalId);
    setMobile(h.mobile);
    setShebaNumber(h.shebaNumber || '');
    setNotes(h.notes || '');
    setFormErrors({});
    if (h.nationalIdImageUrl) {
      setIdCardFile({
        url: h.nationalIdImageUrl,
        name: h.nationalIdImageName || (isRtl ? 'کارت_ملی.jpg' : 'national_id.jpg'),
        size: h.nationalIdImageSize || 0,
        type: h.nationalIdImageType || 'image/jpeg',
      });
    } else {
      setIdCardFile(null);
    }
    setIsAddingOrEditing(true);
  };

  // Process and compress uploaded file
  const processUploadedFile = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      error(isRtl ? 'حجم فایل نمی‌تواند بیشتر از ۲۵ مگابایت باشد.' : 'File size cannot exceed 25 MB.');
      return;
    }

    setIsCompressingImage(true);
    try {
      const compressed = await compressIdCardImage(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.82 });
      setIdCardFile({
        url: compressed.dataUrl,
        name: compressed.name,
        size: compressed.size,
        type: compressed.type,
      });
      success(isRtl ? 'تصویر کارت ملی با موفقیت فشرده و آماده ذخیره شد.' : 'National ID image compressed and ready for save.');
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در بهینه‌سازی و پردازش تصویر مدرک' : 'Error processing document image'));
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Quick upload for an existing holder from the list with compression & storage quota prevention
  const handleQuickUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = quickUploadTargetHolderRef.current || quickUploadTargetHolder;
    if (!file || !target) {
      if (quickUploadInputRef.current) quickUploadInputRef.current.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      error(isRtl ? 'حجم فایل نمی‌تواند بیشتر از ۲۵ مگابایت باشد.' : 'File size cannot exceed 25 MB.');
      if (quickUploadInputRef.current) quickUploadInputRef.current.value = '';
      return;
    }

    setIsCompressingImage(true);
    try {
      const compressed = await compressIdCardImage(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.82 });

      const cleanNational = cleanDigits(target.nationalId || '').padStart(10, '0');
      let cleanMobile = cleanDigits(target.mobile || '');
      if (cleanMobile.length === 10 && cleanMobile.startsWith('9')) {
        cleanMobile = '0' + cleanMobile;
      }

      await storage.saveRegisteredHolder({
        ...target,
        fullName: target.fullName || (isRtl ? 'کاربر ثبت‌کننده' : 'Registered Holder'),
        nationalId: cleanNational,
        mobile: cleanMobile,
        nationalIdImageUrl: compressed.dataUrl,
        nationalIdImageName: compressed.name,
        nationalIdImageSize: compressed.size,
        nationalIdImageType: compressed.type,
        nationalIdImageUploadedBy: currentUser?.name || currentUser?.id || (isRtl ? 'کاربر سیستم' : 'System User'),
        nationalIdImageUploadedAt: new Date().toISOString(),
      });

      success(isRtl ? `تصویر کارت ملی برای «${target.fullName}» با موفقیت ذخیره شد.` : `National ID image for "${target.fullName}" saved successfully.`);
      loadData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در بارگذاری و ذخیره مدرک' : 'Error uploading and saving document'));
    } finally {
      setIsCompressingImage(false);
      setQuickUploadTargetHolder(null);
      quickUploadTargetHolderRef.current = null;
      if (quickUploadInputRef.current) quickUploadInputRef.current.value = '';
    }
  };

  const handleSaveHolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { fullName?: string; nationalId?: string; mobile?: string } = {};

    const cleanName = fullName.trim();
    const rawNational = cleanDigits(nationalId);
    let rawMobile = cleanDigits(mobile);

    // Auto-fix mobile format (e.g., 9123456789 -> 09123456789)
    if (rawMobile.length === 10 && rawMobile.startsWith('9')) {
      rawMobile = '0' + rawMobile;
    }

    if (!cleanName) {
      errors.fullName = isRtl ? 'نام و نام خانوادگی فرد الزامی است.' : 'Full name is required.';
    }

    if (!rawNational || rawNational.length < 8) {
      errors.nationalId = isRtl ? 'کد ملی معتبر حداقل ۸ تا ۱۰ رقم الزامی است.' : 'Valid national ID (8-10 digits) is required.';
    }

    if (!rawMobile || rawMobile.length < 10) {
      errors.mobile = isRtl ? 'شماره همراه معتبر حداقل ۱۰ تا ۱۱ رقم الزامی است.' : 'Valid mobile number (10-11 digits) is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      error(isRtl ? 'لطفاً فیلدهای الزامی مشخص شده را تکمیل فرمایید.' : 'Please complete the required fields.');
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const payload: Partial<RegisteredHolder> = {
        id: editingHolder?.id,
        fullName: cleanName,
        nationalId: rawNational.padStart(10, '0'),
        mobile: rawMobile,
        shebaNumber: shebaNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive: true,
        nationalIdImageUrl: idCardFile?.url || undefined,
        nationalIdImageName: idCardFile?.name || undefined,
        nationalIdImageSize: idCardFile?.size || undefined,
        nationalIdImageType: idCardFile?.type || undefined,
        nationalIdImageUploadedBy: idCardFile ? (currentUser?.name || currentUser?.id || (isRtl ? 'کاربر' : 'User')) : undefined,
        nationalIdImageUploadedAt: idCardFile ? new Date().toISOString() : undefined,
      };

      await storage.saveRegisteredHolder(payload);

      success(editingHolder ? (isRtl ? 'اطلاعات فرد ثبت‌کننده بروزرسانی گردید.' : 'Registered holder details updated.') : (isRtl ? 'شخص ثبت‌کننده جدید با موفقیت ذخیره شد.' : 'New registered holder saved successfully.'));
      setIsAddingOrEditing(false);
      loadData();
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در ذخیره‌سازی اطلاعات فرد ثبت‌کننده' : 'Error saving registered holder information'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to ensure holder has ID card loaded from in-memory or IndexedDB
  const resolveHolderIdCard = async (holder: RegisteredHolder): Promise<string | null> => {
    if (holder.nationalIdImageUrl) return holder.nationalIdImageUrl;
    if (holder.id) {
      try {
        const cached = await idbStorage.get<string>(`holder_idcard_${holder.id}`);
        if (cached) {
          holder.nationalIdImageUrl = cached;
          return cached;
        }
      } catch (_) {}
    }
    return null;
  };

  const handleViewIdCard = async (holder: RegisteredHolder) => {
    const imgUrl = await resolveHolderIdCard(holder);
    if (!imgUrl) {
      error(isRtl ? 'تصویر یا سندی برای این شخص یافت نشد.' : 'No image or document found for this person.');
      return;
    }
    setViewingHolder({ ...holder, nationalIdImageUrl: imgUrl });
  };

  // Download ID card
  const handleDownloadIdCard = async (holder: RegisteredHolder) => {
    const imgUrl = await resolveHolderIdCard(holder);
    if (!imgUrl) {
      error(isRtl ? 'تصویر یا سندی برای دانلود موجود نیست.' : 'No image or document available for download.');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = imgUrl;
      const ext = holder.nationalIdImageName ? holder.nationalIdImageName.split('.').pop() : 'jpg';
      const cleanFileName = `${isRtl ? 'کارت_ملی_' : 'national_id_'}_${holder.fullName.replace(/\s+/g, '_')}_${holder.nationalId}.${ext}`;
      link.download = cleanFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success(isRtl ? 'دانلود مدرک شناسایی آغاز شد.' : 'Identity document download started.');
    } catch (err) {
      error(isRtl ? 'خطا در دانلود فایل مدرک شناسایی' : 'Error downloading identity document');
    }
  };

  // Share ID Card
  const handleShareIdCard = async (holder: RegisteredHolder) => {
    const imgUrl = await resolveHolderIdCard(holder);
    if (!imgUrl) {
      error(isRtl ? 'تصویر یا سندی برای اشتراک‌گذاری موجود نیست.' : 'No image or document available for sharing.');
      return;
    }

    const shareTitle = isRtl ? `کارت ملی ${holder.fullName}` : `National ID: ${holder.fullName}`;
    const shareText = isRtl ? `مدرک شناسایی / کارت ملی ${holder.fullName} (کد ملی: ${holder.nationalId} - موبایل: ${holder.mobile}) ثبت شده در سامانه MMBA` : `National ID / Identity document for ${holder.fullName} (National ID: ${holder.nationalId} - Mobile: ${holder.mobile}) registered in MMBA system`;

    // Try Web Share API with file if supported
    if (navigator.share) {
      try {
        if (imgUrl.startsWith('data:')) {
          // Convert base64 dataUrl to File for native share
          const res = await fetch(imgUrl);
          const blob = await res.blob();
          const ext = holder.nationalIdImageName?.split('.').pop() || 'jpg';
          const file = new File([blob], `${isRtl ? 'کارت_ملی_' : 'national_id_'}${holder.fullName}_${holder.nationalId}.${ext}`, { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              files: [file],
            });
            success(isRtl ? 'مدرک شناسایی با موفقیت به اشتراک گذاشته شد.' : 'Identity document shared successfully.');
            return;
          }
        }

        // Fallback to text share
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        });
        success(isRtl ? 'اطلاعات مدرک به اشتراک گذاشته شد.' : 'Document information shared.');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, showing viewer modal:', err);
        }
      }
    }

    // Open viewer with manual platform share buttons
    setViewingHolder({ ...holder, nationalIdImageUrl: imgUrl });
  };

  // Copy ID card link or info to clipboard
  const handleCopyIdCardInfo = (holder: RegisteredHolder) => {
    const text = isRtl ? `کارت ملی: ${holder.fullName}\nکد ملی: ${holder.nationalId}\nشماره همراه: ${holder.mobile}\nثبت‌شده در سامانه MMBA` : `National ID: ${holder.fullName}\nNational ID number: ${holder.nationalId}\nMobile: ${holder.mobile}\nRegistered in MMBA system`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      success(isRtl ? 'اطلاعات مدرک در کلیپ‌بورد کپی گردید.' : 'Document information copied to clipboard.');
      setTimeout(() => setCopySuccess(false), 2500);
    }).catch(() => {
      error(isRtl ? 'خطا در کپی اطلاعات' : 'Error copying information');
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingHolder) return;
    if (!isManager) {
      error(isRtl ? 'تنها مدیران ارشد و سرپرست سامانه مجاز به حذف افراد ثبت‌کننده هستند.' : 'Only senior administrators and system supervisors can delete registered holders.');
      return;
    }
    if (!deleteReason.trim()) {
      error(isRtl ? 'لطفاً دلیل حذف را جهت ثبت در لاگ نظارتی سیستم وارد نمایید.' : 'Please enter a deletion reason to record in the system audit log.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await storage.deleteRegisteredHolder(deletingHolder.id, deleteReason.trim());
      if (res.success) {
        success(isRtl ? 'شخص ثبت‌کننده با موفقیت حذف گردید و لاگ نظارتی ثبت شد.' : 'Registered holder deleted and audit log recorded.');
        setDeletingHolder(null);
        setDeleteReason('');
        loadData();
      } else {
        error(res.message || (isRtl ? 'امکان حذف این شخص وجود ندارد.' : 'Unable to delete this person.'));
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در فرآیند حذف' : 'Error during deletion process'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مدیریت افراد ثبت‌کننده سیم‌کارت (سندزن / مالکین ثبتی)"
      size="2xl"
    >
      <div className="space-y-5">
        {/* Hidden inputs for file upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
          className="hidden"
        />
        <input
          type="file"
          ref={quickUploadInputRef}
          onChange={handleQuickUploadFile}
          accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
          className="hidden"
        />

        {/* Info banner explaining the 10-SIM legal regulatory constraint */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3 text-xs text-indigo-800 dark:text-indigo-300">
          <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">قانون رگولاتوری و سقف مجاز مالکیت سیم‌کارت:</p>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              طبق مصوبه سازمان تنظیم مقررات، به نام هر شخص حقیقی حداکثر ۱۰ سیم‌کارت فعال در شبکه مخابراتی کشور قابل ثبت است. سامانه وضعیت ظرفیت (سقف ۱۰ خط) و اسناد شناسایی هر فرد را به صورت خودکار نگهداری می‌کند.
            </p>
          </div>
        </div>

        {/* Real-time Image Compression & Storage Optimization Banner */}
        {isCompressingImage && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs shadow-xs animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
            <span className="font-semibold">در حال فشرده‌سازی و بهینه‌سازی خودکار تصویر کارت ملی جهت جلوگیری از پر شدن حافظه مرورگر...</span>
          </div>
        )}

        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با نام، کد ملی، شماره موبایل..."
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold"
          >
            ثبت شخص جدید
          </Button>
        </div>

        {/* Form Mode (Add / Edit) */}
        {isAddingOrEditing && (
          <form onSubmit={handleSaveHolder} className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>{editingHolder ? 'ویرایش اطلاعات شخص ثبت‌کننده' : 'ثبت شخص ثبت‌کننده جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingOrEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>انصراف</span>
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="نام و نام خانوادگی"
                  placeholder="مثال: سید علیرضا حسینی"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formErrors.fullName) setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  error={formErrors.fullName}
                  isRequired
                />
              </div>
              <div>
                <Input
                  label="کد ملی (۱۰ رقم)"
                  placeholder="0012345678"
                  value={nationalId}
                  onChange={(e) => {
                    const clean = cleanDigits(e.target.value);
                    setNationalId(clean);
                    if (formErrors.nationalId) setFormErrors((prev) => ({ ...prev, nationalId: undefined }));
                  }}
                  maxLength={10}
                  error={formErrors.nationalId}
                  isRequired
                />
              </div>
              <div>
                <Input
                  label="شماره همراه"
                  placeholder="09121234567"
                  value={mobile}
                  onChange={(e) => {
                    const clean = cleanDigits(e.target.value);
                    setMobile(clean);
                    if (formErrors.mobile) setFormErrors((prev) => ({ ...prev, mobile: undefined }));
                  }}
                  maxLength={11}
                  error={formErrors.mobile}
                  isRequired
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="شماره شبا یا حساب (اختیاری جهت تسویه)"
                placeholder="IR..."
                value={shebaNumber}
                onChange={(e) => setShebaNumber(e.target.value)}
              />
              <Input
                label="توضیحات و یادداشت"
                placeholder="توضیحات تکمیلی، آدرس یا ملاحظات..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* ID Card Upload Section */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                  <span>تصویر یا مدرک کارت ملی (اختیاری)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  فرمت‌های مجاز: JPG, PNG, WEBP, PDF (حداکثر ۱۵ مگابایت)
                </span>
              </label>

              {!idCardFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                    isDraggingFile
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-white/70 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    برای بارگذاری تصویر کارت ملی کلیک کنید یا فایل را به اینجا بکشید
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    اسکن یا عکس واضح از روی کارت ملی هوشمند شخص
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                    {/* Thumbnail preview */}
                    <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 flex items-center justify-center">
                      {idCardFile.type.startsWith('image/') ? (
                        <img
                          src={idCardFile.url}
                          alt="کارت ملی"
                          className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            // Quick preview
                            setViewingHolder({
                              id: 'preview',
                              fullName: fullName || 'پیش‌نمایش مدرک',
                              nationalId: nationalId || '---',
                              mobile: mobile || '---',
                              isActive: true,
                              nationalIdImageUrl: idCardFile.url,
                              nationalIdImageName: idCardFile.name,
                              nationalIdImageSize: idCardFile.size,
                              nationalIdImageType: idCardFile.type,
                            });
                          }}
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-indigo-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {idCardFile.name}
                        </span>
                        <Badge variant="emerald" size="sm">
                          {formatFileSize(idCardFile.size)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        آماده ذخیره‌سازی در پرونده
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setViewingHolder({
                          id: 'preview',
                          fullName: fullName || 'پیش‌نمایش مدرک',
                          nationalId: nationalId || '---',
                          mobile: mobile || '---',
                          isActive: true,
                          nationalIdImageUrl: idCardFile.url,
                          nationalIdImageName: idCardFile.name,
                          nationalIdImageSize: idCardFile.size,
                          nationalIdImageType: idCardFile.type,
                        });
                      }}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      className="text-xs h-8"
                    >
                      مشاهده
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      className="text-xs h-8"
                    >
                      تغییر
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setIdCardFile(null)}
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                      className="text-xs h-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setIsAddingOrEditing(false)}
              >
                انصراف
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold px-4"
              >
                {editingHolder ? 'بروزرسانی شخص' : 'ذخیره شخص ثبت‌کننده'}
              </Button>
            </div>
          </form>
        )}

        {/* Holders List */}
        <div className="space-y-3 max-h-[520px] overflow-y-auto pe-1">
          {filteredHolders.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold">هیچ شخص ثبت‌کننده‌ای یافت نشد.</p>
              <p className="text-xs text-slate-400 mt-1">با فشردن دکمه «ثبت شخص جدید»، اولین فرد سندزن را تعریف فرمایید.</p>
            </div>
          ) : (
            filteredHolders.map((holder) => {
              const activeCount = holder.activeSimCount || 0;
              const maxCap = holder.maxCapacity || 10;
              const percent = Math.min(100, Math.round((activeCount / maxCap) * 100));
              const isFull = activeCount >= maxCap;
              const hasIdCard = !!(holder.nationalIdImageUrl || holder.nationalIdImageName);

              return (
                <div
                  key={holder.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isFull
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : activeCount >= 8
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  } shadow-xs hover:shadow-sm`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Person Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          {holder.fullName}
                        </span>
                        {isFull ? (
                          <Badge variant="danger" size="sm">تکمیل ظرفیت (۱۰/۱۰)</Badge>
                        ) : (
                          <Badge variant={activeCount >= 8 ? 'warning' : 'emerald'} size="sm">
                            {activeCount} از ۱۰ خط فعال
                          </Badge>
                        )}
                        {hasIdCard ? (
                          <Badge variant="primary" size="sm" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            کارت ملی بارگذاری شده
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            (بدون تصویر کارت ملی)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>کد ملی:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{holder.nationalId}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>موبایل:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{holder.mobile}</span>
                        </span>
                        {holder.shebaNumber && (
                          <span className="font-mono text-[11px] text-slate-400">
                            شبا: {holder.shebaNumber}
                          </span>
                        )}
                      </div>

                      {holder.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-0.5">
                          یادداشت: {holder.notes}
                        </p>
                      )}

                      {/* ID Card Quick Action Bar on Card */}
                      <div className="pt-2 flex items-center gap-2 flex-wrap">
                        {hasIdCard ? (
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs">
                            <button
                              type="button"
                              onClick={() => handleViewIdCard(holder)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 font-semibold flex items-center gap-1 transition-all shadow-2xs"
                              title="مشاهده تصویر کارت ملی"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده کارت ملی</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadIdCard(holder)}
                              className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all"
                              title="دانلود تصویر کارت ملی"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-500" />
                              <span>دانلود</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareIdCard(holder)}
                              className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all"
                              title="اشتراک‌گذاری کارت ملی"
                            >
                              <Share2 className="w-3.5 h-3.5 text-sky-500" />
                              <span>اشتراک</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                quickUploadTargetHolderRef.current = holder;
                                setQuickUploadTargetHolder(holder);
                                if (quickUploadInputRef.current) {
                                  quickUploadInputRef.current.value = '';
                                  quickUploadInputRef.current.click();
                                }
                              }}
                              className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all"
                              title="تغییر یا بارگذاری تصویر جدید"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                              <span>تغییر مدرک</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              quickUploadTargetHolderRef.current = holder;
                              setQuickUploadTargetHolder(holder);
                              if (quickUploadInputRef.current) {
                                quickUploadInputRef.current.value = '';
                                quickUploadInputRef.current.click();
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-400 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1.5 font-bold shadow-2xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>بارگذاری کارت ملی</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions & Capacity Bar */}
                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                      {/* Capacity Visual Progress */}
                      <div className="w-36 space-y-1 text-start">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>ظرفیت:</span>
                          <span className="font-bold">{activeCount} / {maxCap}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              isFull ? 'bg-rose-500' : activeCount >= 8 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 pt-1">
                        {onSelectHolderForFilter && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onSelectHolderForFilter(holder.id, holder.fullName);
                              onClose();
                            }}
                            className="text-xs text-indigo-600 dark:text-indigo-400 h-8 px-2"
                            title="مشاهده سیم‌کارت‌های این فرد"
                          >
                            <Smartphone className="w-3.5 h-3.5 ms-1" />
                            سیم‌کارت‌ها
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(holder)}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 h-8 w-8 p-0"
                          title="ویرایش"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!isManager) {
                              error('تنها مدیران سیستم مجاز به حذف افراد ثبت‌کننده هستند.');
                              return;
                            }
                            if (activeCount > 0) {
                              error(`امکان حذف این شخص وجود ندارد؛ تعداد ${activeCount} سیم‌کارت فعال به نام ایشان ثبت است.`);
                              return;
                            }
                            setDeletingHolder(holder);
                            setDeleteReason('');
                          }}
                          className="text-rose-500 hover:text-rose-700 h-8 w-8 p-0"
                          title="حذف (فقط مدیر)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ID Card Viewer & Multi-Platform Share Modal */}
      {viewingHolder && viewingHolder.nationalIdImageUrl && (
        <Modal
          isOpen={true}
          onClose={() => setViewingHolder(null)}
          title={`کارت ملی: ${viewingHolder.fullName}`}
          subtitle={`کد ملی: ${viewingHolder.nationalId} | شماره همراه: ${viewingHolder.mobile}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Main Preview Container */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-950 p-2 overflow-hidden flex items-center justify-center max-h-[60vh]">
              {viewingHolder.nationalIdImageType === 'application/pdf' ? (
                <iframe
                  src={viewingHolder.nationalIdImageUrl}
                  title="PDF مدرک شناسایی"
                  className="w-full h-96 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <img
                  src={viewingHolder.nationalIdImageUrl}
                  alt={`کارت ملی ${viewingHolder.fullName}`}
                  className="max-h-[55vh] w-auto max-w-full object-contain rounded-xl shadow-md"
                />
              )}
            </div>

            {/* Document Details */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-mono">
                {viewingHolder.nationalIdImageName || 'کارت_ملی.jpg'}
              </span>
              {viewingHolder.nationalIdImageSize && (
                <span>حجم فایل: {formatFileSize(viewingHolder.nationalIdImageSize)}</span>
              )}
            </div>

            {/* Actions: Download and Share to Different Platforms */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownloadIdCard(viewingHolder)}
                  leftIcon={<Download className="w-4 h-4" />}
                  className="font-bold flex-1 sm:flex-initial"
                >
                  دانلود تصویر کارت ملی
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyIdCardInfo(viewingHolder)}
                  leftIcon={copySuccess ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  className="flex-1 sm:flex-initial"
                >
                  {copySuccess ? 'کپی شد' : 'کپی اطلاعات مدرک'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  leftIcon={<Printer className="w-4 h-4" />}
                  className="hidden sm:inline-flex"
                >
                  چاپ
                </Button>
              </div>

              {/* Share to Messaging Platforms */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>اشتراک‌گذاری در پیام‌رسان‌ها و شبکه‌ها:</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `کارت ملی ${viewingHolder.fullName} (کد ملی: ${viewingHolder.nationalId} - همراه: ${viewingHolder.mobile})\nسامانه MMBA`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>واتساپ (WhatsApp)</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
                      `کارت ملی: ${viewingHolder.fullName}\nکد ملی: ${viewingHolder.nationalId}\nهمراه: ${viewingHolder.mobile}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-sky-500/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>تلگرام (Telegram)</span>
                  </a>

                  {/* Eitaa */}
                  <a
                    href={`https://eitaa.com/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
                      `کارت ملی: ${viewingHolder.fullName} - کد ملی: ${viewingHolder.nationalId}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-amber-500/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ایتا (Eitaa)</span>
                  </a>

                  {/* Bale */}
                  <a
                    href={`https://ble.ir/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
                      `کارت ملی: ${viewingHolder.fullName} - کد ملی: ${viewingHolder.nationalId}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-indigo-500/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>بله (Bale)</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingHolder(null)}
              >
                بستن
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal for Manager */}
      {deletingHolder && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingHolder(null)}
          title="تایید حذف شخص ثبت‌کننده (مخصوص مدیریت)"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>حذف شخص ثبتی: {deletingHolder.fullName}</span>
              </p>
              <p>این اقدام در لاگ نظارتی مدیریت ثبت خواهد شد. جهت تایید نهایی، علت حذف را بنویسید:</p>
            </div>

            <Textarea
              label="علت حذف (الزامی)"
              placeholder="مثال: عدم همکاری، تسویه نهایی، ثبت اشتباه..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              isRequired
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingHolder(null)}
              >
                انصراف
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleConfirmDelete}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                تایید و حذف دائم
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
