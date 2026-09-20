import React from 'react';
import { cn } from './Button';
import { useTranslation } from '../../lib/i18n';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Icon at the start of the input (left in LTR, right in RTL) */
  startIcon?: React.ReactNode;
  /** Icon at the end of the input (right in LTR, left in RTL) */
  endIcon?: React.ReactNode;
  /** @deprecated Use startIcon. Kept for backwards compat. */
  leftIcon?: React.ReactNode;
  /** @deprecated Use endIcon. Kept for backwards compat. */
  rightIcon?: React.ReactNode;
  isRequired?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, startIcon, endIcon, isRequired, id, ...props }, ref) => {
    const { isRtl } = useTranslation();
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    // start/end props override left/right for new callers
    const iconStart = startIcon ?? leftIcon;
    const iconEnd = endIcon ?? rightIcon;

    // In RTL, swap visual position: start → right, end → left
    const visualLeft  = isRtl ? iconEnd   : iconStart;
    const visualRight = isRtl ? iconStart : iconEnd;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {label}
            {isRequired && <span className="text-rose-500 dark:text-rose-400 ms-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {visualLeft && (
            <div className="absolute start-3 inset-y-0 flex items-center pointer-events-none text-slate-400">
              {visualLeft}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-950',
              visualLeft ? 'ps-10' : '',
              visualRight ? 'pe-10' : '',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '',
              className
            )}
            {...props}
          />
          {visualRight && (
            <div className="absolute end-3 inset-y-0 flex items-center pointer-events-none text-slate-400">
              {visualRight}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
