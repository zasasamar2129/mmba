import React from 'react';
import { cn } from './Button';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, isRequired, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {label}
            {isRequired && <span className="text-rose-500 dark:text-rose-400 ms-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none rounded-xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) text-sm ps-3.5 pe-9 py-2.5 transition-all duration-200 focus:outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-(--bg-surface) text-(--text-primary) py-2">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute end-3 inset-y-0 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
