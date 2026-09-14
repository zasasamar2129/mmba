import React from 'react';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './Button';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'sky' | 'teal';
  variant?: 'default' | 'card' | 'pill';
  icon?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      checked = false,
      indeterminate = false,
      disabled = false,
      onChange,
      label,
      description,
      size = 'md',
      colorScheme = 'indigo',
      variant = 'default',
      icon,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = id || (typeof label === 'string' ? `cb-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    const sizeStyles = {
      sm: {
        box: 'w-4 h-4 rounded-md',
        icon: 'w-3 h-3',
        text: 'text-xs',
        desc: 'text-[10px]',
      },
      md: {
        box: 'w-5 h-5 rounded-lg',
        icon: 'w-3.5 h-3.5',
        text: 'text-xs sm:text-sm',
        desc: 'text-[11px]',
      },
      lg: {
        box: 'w-6 h-6 rounded-xl',
        icon: 'w-4 h-4',
        text: 'text-sm sm:text-base',
        desc: 'text-xs',
      },
    };

    const schemeGradients: Record<string, { bg: string; glow: string; border: string; pillActive: string }> = {
      indigo: {
        bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 border-indigo-500 text-white',
        glow: 'shadow-md shadow-indigo-500/25',
        border: 'border-indigo-300 dark:border-indigo-500/50',
        pillActive: 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-200',
      },
      emerald: {
        bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-500 text-white',
        glow: 'shadow-md shadow-emerald-500/25',
        border: 'border-emerald-300 dark:border-emerald-500/50',
        pillActive: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200',
      },
      amber: {
        bg: 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-500 text-white',
        glow: 'shadow-md shadow-amber-500/25',
        border: 'border-amber-300 dark:border-amber-500/50',
        pillActive: 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-200',
      },
      rose: {
        bg: 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-500 text-white',
        glow: 'shadow-md shadow-rose-500/25',
        border: 'border-rose-300 dark:border-rose-500/50',
        pillActive: 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-200',
      },
      purple: {
        bg: 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-500 text-white',
        glow: 'shadow-md shadow-purple-500/25',
        border: 'border-purple-300 dark:border-purple-500/50',
        pillActive: 'bg-purple-50 dark:bg-purple-500/15 border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-200',
      },
      sky: {
        bg: 'bg-gradient-to-br from-sky-500 to-sky-600 border-sky-500 text-white',
        glow: 'shadow-md shadow-sky-500/25',
        border: 'border-sky-300 dark:border-sky-500/50',
        pillActive: 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-500/40 text-sky-700 dark:text-sky-200',
      },
      teal: {
        bg: 'bg-gradient-to-br from-teal-500 to-teal-600 border-teal-500 text-white',
        glow: 'shadow-md shadow-teal-500/25',
        border: 'border-teal-300 dark:border-teal-500/50',
        pillActive: 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-700 dark:text-teal-200',
      },
    };

    const currentScheme = schemeGradients[colorScheme] || schemeGradients.indigo;
    const isSelected = checked || indeterminate;

    // Card variant wrapper
    if (variant === 'card') {
      return (
        <label
          htmlFor={generatedId}
          className={cn(
            'flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl cursor-pointer select-none transition-all text-right border',
            isSelected
              ? `${currentScheme.border} bg-indigo-50/70 dark:bg-slate-900/90 ${currentScheme.glow}`
              : 'bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40',
            disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
            className
          )}
        >
          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
            <input
              id={generatedId}
              ref={ref}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={onChange}
              className="sr-only peer"
              aria-checked={indeterminate ? 'mixed' : checked}
              {...props}
            />
            <div
              className={cn(
                'border flex items-center justify-center transition-all duration-200 ring-offset-2 ring-offset-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/60',
                sizeStyles[size].box,
                isSelected
                  ? `${currentScheme.bg} ${currentScheme.glow}`
                  : 'bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
              )}
            >
              <AnimatePresence mode="wait">
                {checked && !indeterminate && (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0, rotate: 20 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                  >
                    <Check className={cn(sizeStyles[size].icon, 'stroke-[3.5]')} />
                  </motion.div>
                )}
                {indeterminate && (
                  <motion.div
                    key="indeterminate"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                  >
                    <Minus className={cn(sizeStyles[size].icon, 'stroke-[3.5]')} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {icon && <span className="shrink-0">{icon}</span>}
              {label && (
                <span
                  className={cn(
                    'font-bold transition-colors truncate',
                    sizeStyles[size].text,
                    isSelected
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
            {description && (
              <span className={cn('text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed', sizeStyles[size].desc)}>
                {description}
              </span>
            )}
          </div>
        </label>
      );
    }

    // Pill variant wrapper (compact filter tag)
    if (variant === 'pill') {
      return (
        <label
          htmlFor={generatedId}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer select-none transition-all text-xs font-semibold border shrink-0',
            isSelected
              ? currentScheme.pillActive
              : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900',
            disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
            className
          )}
        >
          <input
            id={generatedId}
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            aria-checked={indeterminate ? 'mixed' : checked}
            {...props}
          />
          <div
            className={cn(
              'border flex items-center justify-center transition-all duration-200 shrink-0',
              sizeStyles[size].box,
              isSelected
                ? `${currentScheme.bg} ${currentScheme.glow}`
                : 'bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
            )}
          >
            <AnimatePresence mode="wait">
              {checked && !indeterminate && (
                <motion.div
                  key="check"
                  initial={{ scale: 0, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0, rotate: 20 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                >
                  <Check className={cn(sizeStyles[size].icon, 'stroke-[3.5]')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {icon && <span className="shrink-0">{icon}</span>}
          {label && <span className="truncate">{label}</span>}
        </label>
      );
    }

    // Default inline layout
    return (
      <label
        htmlFor={generatedId}
        className={cn(
          'inline-flex items-start gap-2.5 cursor-pointer select-none group transition-all text-right',
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
          className
        )}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            id={generatedId}
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            aria-checked={indeterminate ? 'mixed' : checked}
            {...props}
          />

          <div
            className={cn(
              'border flex items-center justify-center transition-all duration-200 ring-offset-2 ring-offset-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/60',
              sizeStyles[size].box,
              isSelected
                ? `${currentScheme.bg} ${currentScheme.glow}`
                : 'bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-600 group-hover:scale-[1.06]'
            )}
          >
            <AnimatePresence mode="wait">
              {checked && !indeterminate && (
                <motion.div
                  key="check"
                  initial={{ scale: 0, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0, rotate: 20 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                >
                  <Check className={cn(sizeStyles[size].icon, 'stroke-[3.5]')} />
                </motion.div>
              )}

              {indeterminate && (
                <motion.div
                  key="indeterminate"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                >
                  <Minus className={cn(sizeStyles[size].icon, 'stroke-[3.5]')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {(label || description || icon) && (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {icon && <span className="shrink-0">{icon}</span>}
              {label && (
                <span
                  className={cn(
                    'font-medium transition-colors leading-tight',
                    sizeStyles[size].text,
                    isSelected
                      ? 'text-slate-900 dark:text-slate-100 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
            {description && (
              <span className={cn('text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed', sizeStyles[size].desc)}>
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
