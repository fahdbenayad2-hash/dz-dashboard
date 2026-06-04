import type { ReactNode } from 'react';
import { classNames } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'purple' | 'outline';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        variant === 'success' && 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
        variant === 'danger' && 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
        variant === 'warning' && 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
        variant === 'purple' && 'bg-[var(--color-purple)]/10 text-[var(--color-purple)]',
        variant === 'outline' && 'border border-[var(--color-border)] text-[var(--color-text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
