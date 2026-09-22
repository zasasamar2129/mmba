import React, { useId } from 'react';
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
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = useId();
    const helperId = useId();
    const describedByParts: string[] = [];

    // start/end props override left/right for new callers
    const iconStart = startIcon ?? leftIcon;
    const iconEnd = endIcon ?? rightIcon;

    // In RTL, swap visual position: start → right, end → left
    const visualLeft  = isRtl ? iconEnd   : iconStart;
    const visualRight = isRtl ? iconStart : iconEnd;

    if (error) describedByParts.push(errorId);
    if (helperText && !error) describedByParts.push(helperId);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-(--text-primary)">
            {label}
            {isRequired && <span className="text-(--danger) ms-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {visualLeft && (
            <div className="absolute start-3 inset-y-0 flex items-center pointer-events-none text-(--muted-foreground)" aria-hidden="true">
              {visualLeft}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full rounded-xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) text-sm px-3.5 py-2.5 transition-all duration-200 placeholder:text-(--muted-foreground) focus:outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-(--focus)/20 disabled:opacity-50 disabled:bg-(--bg-surface-muted)',
              visualLeft ? 'ps-10' : '',
              visualRight ? 'pe-10' : '',
              error ? 'border-(--danger) focus:border-(--danger) focus:ring-(--danger)/20' : '',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedByParts.length > 0 ? describedByParts.join(' ') : undefined}
            {...props}
          />
          {visualRight && (
            <div className="absolute end-3 inset-y-0 flex items-center pointer-events-none text-(--muted-foreground)" aria-hidden="true">
              {visualRight}
            </div>
          )}
        </div>
        {error && <p id={errorId} className="text-xs text-(--danger) mt-1" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="text-xs text-(--muted-foreground) mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';