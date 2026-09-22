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
    success: 'bg-(--success-bg) text-(--success) border-(--success-border)',
    warning: 'bg-(--warning-bg) text-(--warning) border-(--warning-border)',
    danger: 'bg-(--danger-bg) text-(--danger) border-(--danger-border)',
    info: 'bg-(--info-bg) text-(--info) border-(--info-border)',
    purple: 'bg-(--accent-light) text-(--primary) border-(--accent-primary)/30',
    amber: 'bg-(--warning-bg) text-(--warning) border-(--warning-border)',
    outline: 'bg-transparent text-(--text-secondary) border-(--border)',
  };

  const dotColors = {
    default: 'bg-(--muted-foreground)',
    success: 'bg-(--success)',
    warning: 'bg-(--warning)',
    danger: 'bg-(--danger)',
    info: 'bg-(--info)',
    purple: 'bg-(--primary)',
    amber: 'bg-(--warning)',
    outline: 'bg-(--muted-foreground)',
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
