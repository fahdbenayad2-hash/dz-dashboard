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
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]',
        variant === 'outline' && 'border border-[var(--color-border)] bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
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
