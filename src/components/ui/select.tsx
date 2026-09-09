import type { SelectHTMLAttributes, ReactNode } from 'react';
import { classNames } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={classNames(
        'flex h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm transition-[border-color,box-shadow] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
