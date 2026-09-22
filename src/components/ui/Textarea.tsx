import React, { useId } from 'react';
import { cn } from './Button';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  actionButton?: React.ReactNode;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, isRequired, actionButton, id, rows = 3, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = useId();
    const helperId = useId();
    const describedByParts: string[] = [];

    if (error) describedByParts.push(errorId);
    if (helperText && !error) describedByParts.push(helperId);

    return (
      <div className="w-full space-y-1.5 text-start">
        <div className="flex items-center justify-between">
          {actionButton && <div>{actionButton}</div>}
          {label && (
            <label htmlFor={textareaId} className="block text-xs font-medium text-(--text-primary)">
              {label}
              {isRequired && <span className="text-(--danger) ms-1" aria-hidden="true">*</span>}
            </label>
          )}
        </div>
        <div className="relative">
          <textarea
            id={textareaId}
            ref={ref}
            rows={rows}
            className={cn(
              'w-full rounded-xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) text-sm p-3.5 transition-all duration-200 placeholder:text-(--muted-foreground) focus:outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-(--focus)/20 disabled:opacity-50',
              error ? 'border-(--danger) focus:border-(--danger) focus:ring-(--danger)/20' : '',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedByParts.length > 0 ? describedByParts.join(' ') : undefined}
            {...props}
          />
        </div>
        {error && <p id={errorId} className="text-xs text-(--danger) mt-1" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="text-xs text-(--muted-foreground) mt-1">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';