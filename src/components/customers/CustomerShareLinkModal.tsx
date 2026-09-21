import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Customer, ShareableLink } from '../../types';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Link2, Copy, Check, ShieldCheck, ExternalLink } from 'lucide-react';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';

export interface CustomerShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export const CustomerShareLinkModal: React.FC<CustomerShareLinkModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const { success } = useToast();
  const { isRtl } = useTranslation();
  const [linkType, setLinkType] = useState<'PAYMENT' | 'DOCUMENT' | 'APPOINTMENT' | 'CONTRACT_REVIEW' | 'INFO_REQUEST'>('PAYMENT');
  const [expiryDays, setExpiryDays] = useState('7');
  const [createdLink, setCreatedLink] = useState<ShareableLink | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + Number(expiryDays));

    const newLink = storage.createShareLink({
      type: linkType,
      entityId: customer.id,
      customerId: customer.id,
      expiresAt: expDate.toISOString(),
    });

    setCreatedLink(newLink);
    success(isRtl ? 'لینک امن با موفقیت ایجاد شد' : 'Secure link created successfully');
  };

  const getFullUrl = (token: string) => {
    return `${window.location.origin}/portal/${token}`;
  };

  const handleCopy = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(getFullUrl(createdLink.token));
    setCopied(true);
    success(isRtl ? 'لینک در حافظه کپی شد' : 'Link copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-400" />
          <span>{isRtl ? 'تولید و اشتراک‌گذاری لینک امن مشتری' : 'Generate & Share a Secure Customer Link'}</span>
        </div>
      }
      subtitle={`مشتری: ${customer.name}`}
    >
      {!createdLink ? (
        <form onSubmit={handleGenerate} className="space-y-4">
          <Select
            label={isRtl ? 'نوع فرآیند لینک' : 'Link Purpose'}
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as any)}
            options={[
              { value: 'PAYMENT', label: isRtl ? 'لینک پرداخت وجه و درگاه اختصاصی' : 'Payment link & dedicated gateway' },
              { value: 'CONTRACT_REVIEW', label: isRtl ? 'لینک مشاهده و امضای الکترونیک قرارداد' : 'Contract review & e-sign link' },
              { value: 'DOCUMENT', label: isRtl ? 'لینک آپلود مدارک و پیوست‌ها توسط مشتری' : 'Customer document upload link' },
              { value: 'APPOINTMENT', label: isRtl ? 'لینک تایید و پیشنهاد زمان جلسه/تحویل' : 'Meeting / delivery time link' },
              { value: 'INFO_REQUEST', label: isRtl ? 'لینک تکمیل اطلاعات هویتی و ثبت سفارش' : 'Identity info & order form link' },
            ]}
          />

          <Select
            label={isRtl ? 'مدت اعتبار لینک (انقضای امنیتی)' : 'Link Validity (security expiry)'}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            options={[
              { value: '1', label: isRtl ? '۲۴ ساعت (فوری)' : '24 hours (urgent)' },
              { value: '3', label: isRtl ? '۳ روز' : '3 days' },
              { value: '7', label: isRtl ? '۷ روز (پیش‌فرض)' : '7 days (default)' },
              { value: '30', label: isRtl ? '۳۰ روز' : '30 days' },
            ]}
          />

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isRtl ? 'لینک‌ها دارای توکن امنیتی یکتا بوده و پس از انقضا یا باطل شدن به صورت خودکار مسدود می‌شوند.' : 'Links carry a unique security token and are auto-blocked once expired or revoked.'}
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              تولید لینک یکتا
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-end">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 text-center space-y-3">
            <p className="text-xs text-slate-300">{isRtl ? 'لینک امن آماده ارسال به مشتری است:' : 'Secure link ready to send to the customer:'}</p>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 break-all select-all text-start">
              {getFullUrl(createdLink.token)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی لینک' : 'Copy Link')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getFullUrl(createdLink.token), '_blank')}
                leftIcon={<ExternalLink className="w-4 h-4" />}
              >
                پیش‌نمایش در تب جدید
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreatedLink(null)}>
              ایجاد لینک دیگر
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
