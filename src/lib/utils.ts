export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-DZ') + ' د.ج';
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ar-DZ');
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Confirmed': return 'var(--color-success)';
    case 'Failed': return 'var(--color-danger)';
    case 'Pending': return 'var(--color-warning)';
    case 'Waiting': return 'var(--color-purple)';
    default: return 'var(--color-text-muted)';
  }
}

export function statusBgClass(status: string): string {
  switch (status) {
    case 'Confirmed': return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
    case 'Failed': return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
    case 'Pending': return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';
    case 'Waiting': return 'bg-[var(--color-purple)]/10 text-[var(--color-purple)]';
    default: return 'bg-gray-100 text-gray-600';
  }
}
