import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Printer, Download, FileText, Check, Copy, X, Sliders, Sparkles } from 'lucide-react';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { useToast } from '../ui/Toast';

export type PrintPageSize = 'A4' | 'A5';
export type PrintOrientation = 'portrait' | 'landscape';

export interface GlobalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  documentNumber?: string;
  documentDate?: string;
  children: React.ReactNode;
  defaultPageSize?: PrintPageSize;
  defaultOrientation?: PrintOrientation;
}

export const GlobalPrintModal: React.FC<GlobalPrintModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  documentNumber,
  documentDate = new Date().toISOString(),
  children,
  defaultPageSize = 'A4',
  defaultOrientation = 'portrait',
}) => {
  const { success } = useToast();
  const { isRtl } = useTranslation();
  const [pageSize, setPageSize] = useState<PrintPageSize>(defaultPageSize);
  const [orientation, setOrientation] = useState<PrintOrientation>(defaultOrientation);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handleTriggerPrint = () => {
    // Inject dynamic print style for exact page size and orientation
    const styleId = 'mmba-print-injected-style';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    const sizeCss = pageSize === 'A5'
      ? (orientation === 'landscape' ? 'size: A5 landscape;' : 'size: A5 portrait;')
      : (orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;');

    styleTag.innerHTML = `
      @media print {
        @page {
          ${sizeCss}
          margin: 12mm 10mm 15mm 10mm;
        }
        body * {
          visibility: hidden !important;
        }
        #mmba-print-sheet, #mmba-print-sheet * {
          visibility: visible !important;
        }
        #mmba-print-sheet {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
          box-shadow: none !important;
          border: none !important;
        }
        .no-print {
          display: none !important;
        }
        .page-break {
          page-break-after: always;
        }
      }
    `;

    window.print();
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'سیستم چاپ استاندارد MMBA (A4 / A5)' : 'MMBA Standard Print (A4 / A5)'}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Print Control Toolbar */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Page Size Toggle */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 px-2 font-medium">{isRtl ? 'اندازه برگه:' : 'Paper size:'}</span>
              <button
                type="button"
                onClick={() => setPageSize('A4')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  pageSize === 'A4'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                A4 ({isRtl ? 'استاندارد' : 'Standard'})
              </button>
              <button
                type="button"
                onClick={() => setPageSize('A5')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  pageSize === 'A5'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                A5 ({isRtl ? 'فشرده / اداری' : 'Compact / Office'})
              </button>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 px-2 font-medium">{isRtl ? 'جهت:' : 'Orientation:'}</span>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  orientation === 'portrait'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isRtl ? 'عمودی' : 'Portrait'}
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  orientation === 'landscape'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isRtl ? 'افقی' : 'Landscape'}
              </button>
            </div>

            {/* Font Size Toggle */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 px-2 font-medium">{isRtl ? 'قلم:' : 'Font:'}</span>
              <button
                type="button"
                onClick={() => setFontSize('sm')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  fontSize === 'sm' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRtl ? 'ریز' : 'Small'}
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  fontSize === 'base' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRtl ? 'متوسط' : 'Medium'}
              </button>
              <button
                type="button"
                onClick={() => setFontSize('lg')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  fontSize === 'lg' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRtl ? 'درشت' : 'Large'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerPrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              {isRtl ? 'چاپ مستقیم / ذخیره PDF' : 'Print / Save as PDF'}
            </Button>
          </div>
        </div>

        {/* Paper Simulation Preview Frame */}
        <div className="bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl overflow-auto max-h-[70vh] flex justify-center border border-slate-200 dark:border-slate-800">
          <div
            id="mmba-print-sheet"
            ref={printAreaRef}
            dir="rtl"
            className={`bg-white text-slate-900 shadow-xl rounded-sm p-6 sm:p-8 transition-all border border-slate-200 ${getFontSizeClass()} ${
              pageSize === 'A4'
                ? (orientation === 'portrait' ? 'w-[210mm] min-h-[297mm]' : 'w-[297mm] min-h-[210mm]')
                : (orientation === 'portrait' ? 'w-[148mm] min-h-[210mm]' : 'w-[210mm] min-h-[148mm]')
            }`}
            style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}
          >
            {/* Official MMBA Letterhead */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-lg tracking-wider border border-slate-700">
                  MMBA
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900">{title}</h1>
                  {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
                </div>
              </div>

              <div className="text-start text-xs space-y-1 text-slate-700 font-mono">
                {documentNumber && (
                  <div>
                    <span className="text-slate-500 font-sans">{isRtl ? 'شماره سند: ' : 'Document No: '}</span>
                    <span className="font-bold text-slate-900">{documentNumber}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 font-sans">{isRtl ? 'تاریخ چاپ: ' : 'Print date: '}</span>
                  <span className="font-bold text-slate-900">{formatPersianDate(documentDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{isRtl ? 'اندازه سند: ' : 'Document size: '}</span>
                  <span className="font-bold text-slate-900">{pageSize} - {orientation === 'portrait' ? (isRtl ? 'عمودی' : 'Portrait') : (isRtl ? 'افقی' : 'Landscape')}</span>
                </div>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="space-y-4">
              {children}
            </div>

            {/* Official MMBA Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
              <span>{isRtl ? 'سامانه جامع مدیریت ارتباطات و مشتریان MMBA' : 'MMBA Integrated Customer Relationship Management System'}</span>
              <span>{isRtl ? 'صفحه ۱ از ۱ — سند محرمانه داخلی' : 'Page 1 of 1 — Internal Confidential Document'}</span>
              <span>{isRtl ? 'تولید شده توسط سیستم' : 'Generated by system'}</span>
            </div>
          </div>
        </div>

        {/* Informative Tip */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 text-end flex items-center gap-1.5 justify-end">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>{isRtl ? 'جهت ذخیره فایل PDF، در پنجره بازشده چاپ مرورگر، مقصد (Destination) را روی «Save as PDF» قرار دهید.' : 'To save as PDF, in the browser print dialog set the Destination to "Save as PDF".'}</span>
        </div>
      </div>
    </Modal>
  );
};
