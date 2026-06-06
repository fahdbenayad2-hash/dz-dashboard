import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { classNames } from '@/lib/utils';

interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  color?: string;
}

export function KPICard({ icon, label, value, change, changeLabel, color }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className="relative">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1 overflow-hidden">
          <p className="text-xs font-medium text-[var(--color-text-muted)] line-clamp-2 break-words">{label}</p>
          <p className="text-lg md:text-xl xl:text-2xl font-bold tabular-nums text-[var(--color-text)] whitespace-nowrap">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={classNames(
                'inline-flex items-center gap-0.5 font-medium',
                isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
              )}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(change).toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-[var(--color-text-muted)]">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className="rounded-xl p-3.5 shrink-0"
          style={{ backgroundColor: color ? `${color}15` : 'var(--color-primary)' }}
        >
          <div className="flex items-center justify-center" style={{ color: color || 'var(--color-primary)' }}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}