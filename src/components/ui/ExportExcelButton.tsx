import React, { useState } from 'react';
import { FileSpreadsheet, Download, Check, Loader2 } from 'lucide-react';
import { Button, ButtonProps } from './Button';
import { useToast } from './Toast';
import { cn } from './Button';

export interface ExportExcelButtonProps {
  onExport: () => boolean | void | Promise<boolean | void>;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: ButtonProps['variant'];
  className?: string;
  itemCount?: number;
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  onExport,
  label = 'خروجی اکسل',
  size = 'sm',
  variant = 'outline',
  className,
  itemCount,
}) => {
  const { success, error } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportedRecently, setExportedRecently] = useState(false);

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsExporting(true);
      await new Promise((resolve) => setTimeout(resolve, 200)); // slight debounce for smooth UX
      const result = await onExport();
      if (result !== false) {
        success('فایل اکسل با موفقیت ایجاد و دانلود شد');
        setExportedRecently(true);
        setTimeout(() => setExportedRecently(false), 2500);
      } else {
        error('خطا در ایجاد خروجی اکسل');
      }
    } catch (err) {
      console.error(err);
      error('خطا در تولید فایل گزارش اکسل');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={exportedRecently ? 'success' : variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className={cn('transition-all', className)}
      leftIcon={
        isExporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        ) : exportedRecently ? (
          <Check className="w-3.5 h-3.5 text-white" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
        )
      }
    >
      <span>{exportedRecently ? 'دانلود شد!' : label}</span>
      {itemCount !== undefined && !exportedRecently && (
        <span className="text-[10px] opacity-75 font-mono me-1">({itemCount})</span>
      )}
    </Button>
  );
};
