import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { User, ProblemReportPriority } from '../../types';
import { storage } from '../../services/storage';
import { logger } from '../../services/logger';
import { useToast } from './Toast';
import {
  AlertTriangle, Camera, Send, X, RefreshCw, Sparkles, Check,
  Bug, Laptop, Sliders, FileQuestion, Image as ImageIcon, Trash2
} from 'lucide-react';

export interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { success, error: toastError } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'BUG' | 'UI_ISSUE' | 'DATA_SYNC' | 'FEATURE_REQUEST' | 'OTHER'>('BUG');
  const [priority, setPriority] = useState<ProblemReportPriority>(ProblemReportPriority.NORMAL);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setCategory('BUG');
      setPriority(ProblemReportPriority.NORMAL);
      setScreenshot(null);
    }
  }, [isOpen]);

  const handleManualImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toastError('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setScreenshot(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError('لطفاً عنوان گزارش مشکل را وارد فرمایید.');
      return;
    }
    if (!description.trim()) {
      toastError('لطفاً شرح و جزئیات مشکل پیش‌آمده را توضیح دهید.');
      return;
    }

    try {
      setIsSubmitting(true);

      const savedReport = await storage.saveProblemReport({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'PENDING',
        screenshotUrl: screenshot || undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        userMobile: currentUser.mobile,
      });

      logger.info(`گزارش مشکل جدید توسط ${currentUser.name} ارسال شد: ${title.trim()}`, 'user', {
        reportId: savedReport.id,
        category,
        priority,
      });

      success('گزارش مشکل با موفقیت ثبت شد و برای مدیران سیستم ارسال گردید.');
      onClose();
    } catch (err: any) {
      console.error('Submit report error:', err);
      toastError('خطا در ثبت گزارش مشکل. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">ثبت گزارش خطا و اشکال در سامانه</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">ارسال مستقیم گزارش به همراه اسکرین‌شات و مشخصات فنی به مدیران</p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-end">
        {/* Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              دسته‌بندی موضوع:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="BUG">🐛 خطای سیستمی یا عملکردی (Bug)</option>
              <option value="UI_ISSUE">🎨 به‌هم‌ریختگی ظاهری یا نمایش (UI)</option>
              <option value="DATA_SYNC">🔄 عدم ذخیره یا همگام‌سازی داده</option>
              <option value="FEATURE_REQUEST">💡 پیشنهاد و بهبود قابلیت</option>
              <option value="OTHER">❓ سایر موارد</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              میزان اهمیت و اولویت:
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value={ProblemReportPriority.LOW}>پایین (Low)</option>
              <option value={ProblemReportPriority.NORMAL}>عادی (Normal)</option>
              <option value={ProblemReportPriority.HIGH}>مهم و فوری (High)</option>
              <option value={ProblemReportPriority.CRITICAL}>بحرانی و توقف عملیات (Critical)</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <Input
          label="عنوان مختصر مشکل"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: دکمه ثبت دریافت وجه در صفحه چک‌ها عمل نمی‌کند..."
          isRequired
        />

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            شرح دقیق و مراحل تکرار مشکل: <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="دقیقاً چه عملیاتی انجام می‌دادید، چه پیامی مشاهده کردید و چه انتظاری داشتید..."
            rows={4}
            className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            required
          />
        </div>

        {/* Screenshot Section */}
        <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>تصویر و اسکرین‌شات از صفحه (ضمیمه خطا)</span>
            </span>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>انتخاب و بارگذاری تصویر اسکرین‌شات</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleManualImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {screenshot ? (
            <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 group">
              <img
                src={screenshot}
                alt="اسکرین‌شات ضمیمه"
                className="w-full max-h-48 object-contain mx-auto"
              />
              <button
                type="button"
                onClick={() => setScreenshot(null)}
                className="absolute top-2 end-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-transform active:scale-90"
                title="حذف تصویر"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              می‌توانید تصویر یا اسکرین‌شات خطا را از طریق دکمه بالا بارگذاری نمایید تا بررسی برای تیم مدیریت دقیق‌تر و سریع‌تر انجام شود.
            </p>
          )}
        </div>

        {/* User context footer */}
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>ارسال‌کننده: <strong className="text-slate-900 dark:text-slate-200">{currentUser.name}</strong> ({currentUser.role})</span>
          <span className="font-mono text-slate-500">{currentUser.email || currentUser.mobile || `@${currentUser.username}`}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            انصراف
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            leftIcon={<Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />}
            className="bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 border-none"
          >
            {isSubmitting ? 'در حال ثبت...' : 'ارسال گزارش مشکل به مدیریت'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
