import React, { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './Button';
import { useTranslation } from '../../lib/i18n';
import { useFocusTrap } from '../../lib/useFocusTrap';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  position = 'right',
  className,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
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

  useFocusTrap(dialogRef, isOpen);

  const slideVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
  };

  const posClasses = {
    right: 'inset-y-0 end-0 w-full max-w-md sm:max-w-lg border-s border-(--border-subtle)',
    left: 'inset-y-0 start-0 w-full max-w-md sm:max-w-lg border-e border-(--border-subtle)',
    bottom: 'inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl border-t border-(--border-subtle)',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 app-modal-backdrop backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            tabIndex={-1}
            variants={slideVariants[position]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
              'fixed bg-(--bg-surface) text-(--text-primary) z-10 flex flex-col shadow-2xl focus:outline-none',
              posClasses[position],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-(--border-subtle) bg-(--bg-surface-subtle)">
              <div className="space-y-0.5 text-start flex-1 pe-2">
                {typeof title === 'string' ? (
                  <h3 id={titleId} className="text-base sm:text-lg font-bold text-(--text-primary)">{title}</h3>
                ) : (
                  title
                )}
                {subtitle && <p id={subtitleId} className="text-xs text-(--muted-foreground)">{subtitle}</p>}
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
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-start">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="p-4 sm:px-6 sm:py-4 border-t border-(--border-subtle) bg-(--bg-surface-subtle) flex items-center justify-end gap-2.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
