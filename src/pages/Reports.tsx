import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TrackingOrder } from '@/types';
import { retryImport } from '@/lib/retryImport';

const DailyTrends = lazy(() => retryImport(() => import('@/features/analytics/DailyTrends'), 'daily-report').then(module => ({ default: module.DailyTrends })));
const MonthlyReport = lazy(() => retryImport(() => import('./MonthlyReport'), 'monthly-report').then(module => ({ default: module.MonthlyReport })));
const YearlyReport = lazy(() => retryImport(() => import('./YearlyReport'), 'yearly-report').then(module => ({ default: module.YearlyReport })));
type View = 'daily' | 'monthly' | 'yearly';

export function Reports({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const view: View = requested === 'daily' || requested === 'yearly' ? requested : 'monthly';
  const tabs: { value: View; label: string }[] = [{ value: 'daily', label: 'يومي' }, { value: 'monthly', label: 'شهري' }, { value: 'yearly', label: 'سنوي' }];
  return <div className="space-y-4">
    <div className="flex w-fit gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {tabs.map(tab => <button key={tab.value} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === tab.value ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'}`} onClick={() => setParams({ view: tab.value })}>{tab.label}</button>)}
    </div>
    <Suspense fallback={<p role="status">جاري فتح التقرير...</p>}>
      {view === 'daily' ? <DailyTrends trackingOrders={trackingOrders} /> : view === 'yearly' ? <YearlyReport trackingOrders={trackingOrders} /> : <MonthlyReport trackingOrders={trackingOrders} />}
    </Suspense>
  </div>;
}
