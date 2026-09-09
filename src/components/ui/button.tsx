import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ variant = 'default', size = 'md', children, className, ...props }: ButtonProps) {
  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-[var(--color-primary)] text-white shadow-sm shadow-blue-500/20 hover:bg-[var(--color-primary-dark)] hover:shadow-md hover:shadow-blue-500/20',
        variant === 'outline' && 'border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm hover:border-[var(--color-primary)]/25 hover:bg-blue-50/70 dark:hover:bg-blue-950/20',
        variant === 'ghost' && 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
        variant === 'danger' && 'bg-[var(--color-danger)] text-white hover:bg-red-600',
        size === 'sm' && 'h-8 px-3 text-sm gap-1.5',
        size === 'md' && 'h-10 px-4 text-sm gap-2',
        size === 'lg' && 'h-12 px-6 text-base gap-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
