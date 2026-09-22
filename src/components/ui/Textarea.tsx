import React from 'react';
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
    const textareaId = id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        <div className="flex items-center justify-between">
          {actionButton && <div>{actionButton}</div>}
          {label && (
            <label htmlFor={textareaId} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {label}
              {isRequired && <span className="text-rose-500 dark:text-rose-400 ms-1">*</span>}
            </label>
          )}
        </div>
        <div className="relative">
          <textarea
            id={textareaId}
            ref={ref}
            rows={rows}
            className={cn(
              'w-full rounded-xl bg-(--bg-surface) border border-(--border-subtle) text-(--text-primary) text-sm p-3.5 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-(--border-focus) focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
