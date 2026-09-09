import { AlertTriangle, CheckCircle2, Clock3, Database, XCircle } from 'lucide-react';
import { classNames } from '@/lib/utils';

interface DataHealthIndicatorProps {
  completedAt?: string;
  ordersUpdated: Date | null;
  trackingUpdated: Date | null;
  ordersError: string | null;
  trackingError: string | null;
  now: number;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'غير متاح';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return date.toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' });
}

export function DataHealthIndicator({
  completedAt,
  ordersUpdated,
  trackingUpdated,
  ordersError,
  trackingError,
  now,
}: DataHealthIndicatorProps) {
  const completedTime = completedAt ? new Date(completedAt).getTime() : Number.NaN;
  const stale = Number.isFinite(completedTime) && now - completedTime > 6 * 60 * 60 * 1000;
  const unavailable = (!ordersUpdated && !!ordersError) || (!trackingUpdated && !!trackingError);
  const warning = !unavailable && (stale || !!ordersError || !!trackingError || !completedAt);

  const label = unavailable ? 'البيانات غير متاحة' : warning ? 'البيانات تحتاج مراجعة' : 'حالة البيانات جيدة';
  const Icon = unavailable ? XCircle : warning ? AlertTriangle : CheckCircle2;

  return (
    <details className="relative group">
      <summary
        className={classNames(
          'flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] [&::-webkit-details-marker]:hidden',
          unavailable && 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
          warning && 'bg-[var(--color-warning)]/12 text-amber-700 dark:text-amber-300',
          !unavailable && !warning && 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
        )}
        aria-label={`${label}. اضغط لعرض التفاصيل`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </summary>

      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--color-text)] shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--color-primary)]" />
          <p className="text-sm font-bold">تفاصيل مصادر البيانات</p>
        </div>
        <div className="space-y-3 text-xs">
          <SourceRow label="طلبات Orders" updated={ordersUpdated} error={ordersError} />
          <SourceRow label="تتبع Tracking" updated={trackingUpdated} error={trackingError} />
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--color-text-muted)]">آخر مزامنة مكتملة</span>
              <span className="text-left font-medium tabular-nums">{formatDate(completedAt)}</span>
            </div>
            <p className="mt-2 leading-5 text-[var(--color-text-muted)]">
              وقت القراءة يثبت وصول البيانات للوحة، وتاريخ المزامنة يثبت اكتمال النسخة المنشورة.
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

function SourceRow({ label, updated, error }: { label: string; updated: Date | null; error: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className={classNames('h-2 w-2 rounded-full', error ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]')} />
        <span className="font-medium">{label}</span>
      </div>
      <span className="flex items-center gap-1 text-left text-[var(--color-text-muted)] tabular-nums">
        <Clock3 className="h-3 w-3" />
        {error ? 'خطأ في القراءة' : formatDate(updated)}
      </span>
    </div>
  );
}
