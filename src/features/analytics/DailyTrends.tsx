import { useMemo } from 'react';
import type { TrackingOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeltaCard } from '@/components/shared/DeltaCard';
import { LineChart } from '@/components/charts/LineChart';
import { businessDate } from '@/lib/businessDate';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { DollarSign, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react';

type DayMetrics = { totalOrders: number; delivered: number; returned: number; revenue: number };
const emptyDay = (): DayMetrics => ({ totalOrders: 0, delivered: 0, returned: 0, revenue: 0 });
const rate = (day: DayMetrics) => {
  const settled = day.delivered + day.returned;
  return settled > 0 ? day.delivered / settled * 100 : 0;
};
const pct = (current: number, previous: number) => previous === 0 ? (current === 0 ? 0 : 100) : (current - previous) / Math.abs(previous) * 100;

export function DailyTrends({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const model = useMemo(() => {
    const days = new Map<string, DayMetrics>();
    let latest: Date | null = null;
    for (const order of trackingOrders) {
      if (!order.date || Number.isNaN(order.date.getTime())) continue;
      const key = businessDate(order.date);
      const day = days.get(key) ?? emptyDay();
      day.totalOrders += 1;
      if (order.statusCategory === 'delivered') { day.delivered += 1; day.revenue += order.total; }
      if (order.statusCategory === 'returned') day.returned += 1;
      days.set(key, day);
      if (!latest || order.date > latest) latest = order.date;
    }
    const anchor = latest ?? new Date();
    const keys = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(anchor);
      date.setDate(date.getDate() - (29 - index));
      return businessDate(date);
    });
    const series = keys.map(key => days.get(key) ?? emptyDay());
    const movingAverage = series.map((_, index) => {
      const slice = series.slice(Math.max(0, index - 6), index + 1);
      const delivered = slice.reduce((sum, day) => sum + day.delivered, 0);
      const returned = slice.reduce((sum, day) => sum + day.returned, 0);
      return delivered + returned > 0 ? delivered / (delivered + returned) * 100 : 0;
    });
    return { keys, series, movingAverage, latestKey: keys.at(-1) ?? '', latest: series.at(-1) ?? emptyDay(), previous: series.at(-2) ?? emptyDay() };
  }, [trackingOrders]);

  const deliveryRate = rate(model.latest);
  const previousDeliveryRate = rate(model.previous);
  const latestReturnRate = model.latest.delivered + model.latest.returned > 0 ? 100 - deliveryRate : 0;
  const previousReturnRate = model.previous.delivered + model.previous.returned > 0 ? 100 - previousDeliveryRate : 0;

  return <div className="space-y-6">
    <p className="text-sm leading-6 text-[var(--color-text-muted)]">
      هذه السلسلة تُحسب مباشرة من تاريخ حالة التتبع <strong>{model.latestKey}</strong> في Octomatic. التاريخ هنا هو <code>date_and_time</code> لحالة الشحنة، وليس تاريخ إنشاء الطلب ولا لقطة محفوظة في المتصفح.
    </p>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <DeltaCard icon={<TrendingUp className="h-5 w-5" />} label="التوصيل من المحسوم" value={`${deliveryRate.toFixed(1)}%`} change={deliveryRate - previousDeliveryRate} changeLabel="نقطة عن اليوم السابق" />
      <DeltaCard icon={<TrendingDown className="h-5 w-5" />} label="الإرجاع من المحسوم" value={`${latestReturnRate.toFixed(1)}%`} change={latestReturnRate - previousReturnRate} changeLabel="نقطة عن اليوم السابق" invertSemantics color="var(--color-danger)" />
      <DeltaCard icon={<DollarSign className="h-5 w-5" />} label="إيراد المسلّم" value={formatCurrency(model.latest.revenue)} change={pct(model.latest.revenue, model.previous.revenue)} changeLabel="عن اليوم السابق" />
      <DeltaCard icon={<ShoppingCart className="h-5 w-5" />} label="حالات التتبع" value={formatNumber(model.latest.totalOrders)} change={pct(model.latest.totalOrders, model.previous.totalOrders)} changeLabel="عن اليوم السابق" />
    </div>
    <Card><CardHeader><CardTitle>آخر 30 يوماً من المصدر</CardTitle></CardHeader><CardContent><div className="h-72"><LineChart labels={model.keys.map(key => key.slice(5))} datasets={[
      { label: 'التوصيل من المحسوم', data: model.series.map(rate), color: '#1D9E75' },
      { label: 'متوسط موزون 7 أيام', data: model.movingAverage, color: '#378ADD', borderDash: [5, 5] },
      { label: 'الإرجاع من المحسوم', data: model.series.map(day => day.delivered + day.returned > 0 ? 100 - rate(day) : 0), color: '#E24B4A' },
    ]} /></div></CardContent></Card>
  </div>;
}
