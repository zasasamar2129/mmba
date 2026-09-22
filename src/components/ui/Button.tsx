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
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-page) disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-(--primary) hover:bg-(--accent-hover) text-(--primary-foreground) shadow-sm border border-transparent focus-visible:ring-(--focus)',
      secondary:
        'bg-(--secondary) hover:bg-(--bg-surface-elevated) text-(--secondary-foreground) border border-(--border-muted) shadow-xs focus-visible:ring-(--focus)',
      outline:
        'bg-(--bg-surface) border border-(--border) hover:border-(--muted-foreground) text-(--text-primary) hover:bg-(--surface-muted) shadow-xs focus-visible:ring-(--focus)',
      ghost:
        'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-muted) focus-visible:ring-(--focus)',
      danger:
        'bg-(--danger) hover:brightness-90 text-(--primary-foreground) shadow-sm border border-transparent focus-visible:ring-(--danger)',
      success:
        'bg-(--success) hover:brightness-90 text-(--primary-foreground) shadow-sm border border-transparent focus-visible:ring-(--success)',
      glass:
        'liquid-glass-subtle hover:bg-(--surface-muted) text-(--text-primary) border border-(--border-muted) shadow-md focus-visible:ring-(--focus)',
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
        aria-busy={isLoading || undefined}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
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
