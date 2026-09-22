import React from 'react';
import { cn } from './Button';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple'
    | 'amber'
    | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-(--bg-surface-subtle) text-(--text-secondary) border-(--border-subtle)',
    success: 'bg-(--success-bg) text-emerald-700 dark:text-emerald-400 border-(--success-border)',
    warning: 'bg-(--warning-bg) text-amber-800 dark:text-amber-300 border-(--warning-border)',
    danger: 'bg-(--danger-bg) text-rose-700 dark:text-rose-400 border-(--danger-border)',
    info: 'bg-(--info-bg) text-sky-700 dark:text-sky-400 border-(--info-border)',
    purple: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25',
    amber: 'bg-(--warning-bg) text-amber-800 dark:text-amber-400 border-(--warning-border)',
    outline: 'bg-transparent text-(--text-secondary) border-slate-300 dark:border-slate-600',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500 animate-pulse',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500 animate-pulse',
    info: 'bg-sky-500',
    purple: 'bg-indigo-500',
    amber: 'bg-amber-500',
    outline: 'bg-slate-400',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
