import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from './Button';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const duration = toast.duration || 4000;
      setToasts((prev) => [...prev, { ...toast, id }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => showToast({ type: 'success', title, message }), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast({ type: 'error', title, message }), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast({ type: 'warning', title, message }), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast({ type: 'info', title, message }), [showToast]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
  };

  const borders = {
    success: 'border-(--success-border) bg-(--bg-surface) text-(--text-primary) shadow-lg shadow-emerald-500/10',
    error: 'border-(--danger-border) bg-(--bg-surface) text-(--text-primary) shadow-lg shadow-rose-500/10',
    warning: 'border-(--warning-border) bg-(--bg-surface) text-(--text-primary) shadow-lg shadow-amber-500/10',
    info: 'border-(--info-border) bg-(--bg-surface) text-(--text-primary) shadow-lg shadow-sky-500/10',
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div className="fixed bottom-4 start-4 end-4 sm:right-auto sm:start-6 z-[200] flex flex-col gap-2.5 max-w-md pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={cn(
                'pointer-events-auto rounded-xl p-3.5 border shadow-xl flex items-start gap-3 backdrop-blur-xl transition-all',
                borders[t.type]
              )}
            >
              {icons[t.type]}
              <div className="flex-1 text-end">
                <h4 className="text-xs sm:text-sm font-semibold">{t.title}</h4>
                {t.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
