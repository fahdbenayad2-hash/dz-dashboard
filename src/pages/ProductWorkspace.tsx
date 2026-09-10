import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TrackingOrder } from '@/types';

const Products = lazy(() => import('./Products').then(module => ({ default: module.Products })));
const ProductAnalysis = lazy(() => import('./ProductAnalysis').then(module => ({ default: module.ProductAnalysis })));

export function ProductWorkspace({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'analysis' ? 'analysis' : 'products';
  return <div className="space-y-4">
    <div className="flex w-fit gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      <button className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'products' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'}`} onClick={() => setParams({})}>الأداء والتسعير</button>
      <button className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'analysis' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'}`} onClick={() => setParams({ view: 'analysis' })}>التحليل المالي</button>
    </div>
    <Suspense fallback={<p role="status">جاري فتح التحليل...</p>}>
      {view === 'analysis' ? <ProductAnalysis trackingOrders={trackingOrders} /> : <Products trackingOrders={trackingOrders} />}
    </Suspense>
  </div>;
}
