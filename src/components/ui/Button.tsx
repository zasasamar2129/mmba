import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'glass';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30 focus:ring-(--border-focus)',
      secondary:
        'bg-(--bg-surface-subtle) hover:bg-slate-200 dark:hover:bg-slate-700 text-(--text-primary) border border-(--border-subtle) shadow-xs focus:ring-slate-400',
      outline:
        'bg-(--bg-surface) border border-(--border-primary) hover:border-slate-400 dark:hover:border-slate-500 text-(--text-primary) hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs focus:ring-slate-400',
      ghost:
        'text-(--text-secondary) hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:ring-slate-500',
      danger:
        'bg-(--danger) hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 border border-rose-500/30 focus:ring-rose-500',
      success:
        'bg-(--success) hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 border border-emerald-500/30 focus:ring-emerald-500',
      glass:
        'liquid-glass-subtle hover:bg-slate-200/50 dark:hover:bg-slate-700/40 text-(--text-primary) border border-(--border-subtle) dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-md focus:ring-(--border-focus)',
    };

    const sizes = {
      xs: 'text-xs px-2.5 py-1 gap-1.5 min-h-[30px]',
      sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[36px]',
      md: 'text-sm px-4 py-2 gap-2 min-h-[42px]',
      lg: 'text-base px-6 py-2.5 gap-2.5 min-h-[48px]',
      icon: 'p-2 min-h-[38px] min-w-[38px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            {children && <span className="truncate">{children}</span>}
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
