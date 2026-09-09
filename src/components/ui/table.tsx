import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { classNames } from '@/lib/utils';

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={classNames('w-full caption-bottom text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={classNames('sticky top-0 z-[1] border-b border-[var(--color-border)] bg-gray-50/95 backdrop-blur dark:bg-gray-900/90', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={classNames('[&_tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={classNames(
        'border-b border-[var(--color-border)] transition-colors odd:bg-transparent even:bg-gray-50/35 hover:bg-blue-50/65 dark:even:bg-white/[0.015] dark:hover:bg-blue-950/20',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={classNames(
        'h-11 px-3 text-right align-middle text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={classNames('px-3 py-3.5 align-middle text-[var(--color-text)]', className)} {...props}>
      {children}
    </td>
  );
}
