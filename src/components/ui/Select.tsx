import React, { useId } from 'react';
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
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = useId();
    const helperId = useId();
    const describedByParts: string[] = [];

    if (error) describedByParts.push(errorId);
    if (helperText && !error) describedByParts.push(helperId);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-(--text-primary)">
            {label}
            {isRequired && <span className="text-(--danger) ms-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none rounded-xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) text-sm ps-3.5 pe-9 py-2.5 transition-all duration-200 focus:outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-(--focus)/20 disabled:opacity-50',
              error ? 'border-(--danger) focus:border-(--danger) focus:ring-(--danger)/20' : '',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedByParts.length > 0 ? describedByParts.join(' ') : undefined}
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
          <div className="absolute end-3 inset-y-0 flex items-center pointer-events-none text-(--muted-foreground)" aria-hidden="true">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p id={errorId} className="text-xs text-(--danger) mt-1" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="text-xs text-(--muted-foreground) mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';