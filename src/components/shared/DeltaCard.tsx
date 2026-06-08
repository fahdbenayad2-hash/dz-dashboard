import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { classNames } from '@/lib/utils';

interface DeltaCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  invertSemantics?: boolean;
  color?: string;
}

export function DeltaCard({ icon, label, value, change, changeLabel, invertSemantics, color: explicitColor }: DeltaCardProps) {
  const rawChange = change ?? 0;

  const isGood = invertSemantics ? rawChange <= 0 : rawChange >= 0;
  const color = explicitColor || (isGood ? 'var(--color-success)' : 'var(--color-danger)');
  const ArrowIcon = isGood ? TrendingUp : TrendingDown;

  const digits = (value.match(/\d/g) || []).length;
  const valueSize = digits <= 6
    ? 'text-lg sm:text-xl lg:text-2xl'
    : 'text-sm sm:text-base lg:text-lg';

  return (
    <Card className="relative">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--color-text-muted)] line-clamp-2 break-words">{label}</p>
          <p className={`${valueSize} font-bold tabular-nums text-[var(--color-text)]`} title={value}>{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={classNames(
                'inline-flex items-center gap-0.5 font-medium',
                isGood ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
              )}>
                <ArrowIcon className="h-3 w-3" />
                {Math.abs(rawChange).toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-[var(--color-text-muted)]">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className="rounded-xl p-3.5 shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <div className="flex items-center justify-center" style={{ color }}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}
