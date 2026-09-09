import type { HTMLAttributes } from 'react';
import { classNames } from '@/lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-200 dark:shadow-[0_12px_30px_rgba(0,0,0,0.16)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={classNames('text-lg font-semibold text-[var(--color-text)]', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames(className)} {...props}>
      {children}
    </div>
  );
}
