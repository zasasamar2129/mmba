import React, { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './Button';
import { useTranslation } from '../../lib/i18n';
import { useFocusTrap } from '../../lib/useFocusTrap';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth,
  size,
  className,
}) => {
  const [mounted, setMounted] = useState(false);
  const { isRtl, t } = useTranslation();
  const effectiveMaxWidth = size || maxWidth || 'lg';
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useFocusTrap(dialogRef, isOpen && mounted);

  const maxWClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw] sm:max-w-6xl',
  };

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 app-modal-backdrop backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Content */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className={cn(
              'relative w-full rounded-2xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden my-auto focus:outline-none',
              maxWClasses[effectiveMaxWidth],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-(--border-subtle) bg-(--bg-surface-subtle)">
              <div className="space-y-0.5 text-start flex-1 pe-2">
                {typeof title === 'string' ? (
                  <h3 id={titleId} className="text-base sm:text-lg font-bold text-(--text-primary)">
                    {title}
                  </h3>
                ) : (
                  title
                )}
                {subtitle && (
                  typeof subtitle === 'string' ? (
                    <p id={subtitleId} className="text-xs text-(--muted-foreground)">{subtitle}</p>
                  ) : (
                    <div id={subtitleId} className="text-xs text-(--muted-foreground)">{subtitle}</div>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-(--muted-foreground) hover:text-(--text-primary) hover:bg-(--bg-surface-elevated) rounded-lg transition-colors ms-2 shrink-0 min-h-[32px] min-w-[32px]"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 text-start">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="p-4 sm:px-6 sm:py-4 border-t border-(--border-subtle) bg-(--bg-surface-subtle) flex items-center justify-end gap-2.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
