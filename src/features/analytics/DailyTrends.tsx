import { useMemo } from 'react';
import type { TrackingOrder, DailySnapshot } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeltaCard } from '@/components/shared/DeltaCard';
import { LineChart } from '@/components/charts/LineChart';
import { useDailyHistory } from '@/hooks/useDailyHistory';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Save } from 'lucide-react';

interface DailyTrendsProps {
  trackingOrders: TrackingOrder[];
}

export function DailyTrends({ trackingOrders }: DailyTrendsProps) {
  const { snapshots, todayMetrics, delta, ma7, ma30, todaySaved, saveToday } = useDailyHistory(trackingOrders);

  const last30Snapshots = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.slice(-30);
  }, [snapshots]);

  const chartData = useMemo(() => {
    if (last30Snapshots.length === 0) return null;
    const labels: string[] = [];
    const returnRateData: number[] = [];
    const deliveryRateData: number[] = [];
    const ma7Data: number[] = [];
    const ma30Data: number[] = [];

    for (let i = 0; i < last30Snapshots.length; i++) {
      const s = last30Snapshots[i];
      labels.push(s.date.slice(5));
      const settled = s.delivered + s.returned;
      returnRateData.push(settled > 0 ? (s.returned / settled) * 100 : 0);
      deliveryRateData.push(settled > 0 ? (s.delivered / settled) * 100 : 0);

      if (i >= 6) {
        const slice = last30Snapshots.slice(i - 6, i + 1);
        const avgDelivery = slice.reduce((sum, d) => {
          const st = d.delivered + d.returned;
          return sum + (st > 0 ? (d.delivered / st) * 100 : 0);
        }, 0) / 7;
        const avgReturn = slice.reduce((sum, d) => {
          const st = d.delivered + d.returned;
          return sum + (st > 0 ? (d.returned / st) * 100 : 0);
        }, 0) / 7;
        ma7Data.push(avgDelivery);
      } else {
        ma7Data.push(null as unknown as number);
      }

      if (i >= 29) {
        const avgDelivery = last30Snapshots.reduce((sum, d) => {
          const st = d.delivered + d.returned;
          return sum + (st > 0 ? (d.delivered / st) * 100 : 0);
        }, 0) / 30;
        ma30Data.push(avgDelivery);
      } else {
        ma30Data.push(null as unknown as number);
      }
    }

    return { labels, returnRateData, deliveryRateData, ma7Data, ma30Data };
  }, [last30Snapshots]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">الاتجاهات اليومية</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <DeltaCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="معدل التوصيل"
          value={todayMetrics.deliveryRate.toFixed(1) + '%'}
          change={delta.deliveryRate}
          changeLabel="عن أمس"
        />
        <DeltaCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="معدل الإرجاع"
          value={todayMetrics.returnRate.toFixed(1) + '%'}
          change={delta.returnRate}
          changeLabel="عن أمس"
          invertSemantics
          color="var(--color-danger)"
        />
        <DeltaCard
          icon={<DollarSign className="h-5 w-5" />}
          label="صافي الإيراد"
          value={formatCurrency(todayMetrics.netRevenue)}
          change={delta.netRevenue > 0 ? (delta.netRevenue / Math.max(Math.abs(todayMetrics.netRevenue - delta.netRevenue), 1)) * 100 : 0}
          changeLabel="عن أمس"
        />
        <DeltaCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="إجمالي الطلبات"
          value={formatNumber(todayMetrics.totalOrders)}
          change={delta.totalOrders > 0 ? (delta.totalOrders / Math.max(todayMetrics.totalOrders - delta.totalOrders, 1)) * 100 : 0}
          changeLabel="عن أمس"
          invertSemantics={false}
        />
      </div>

      {chartData && (
        <Card>
          <CardHeader>
            <CardTitle>آخر 30 يوم — معدل التوصيل والإرجاع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={chartData.labels}
                datasets={[
                  { label: 'معدل الإرجاع', data: chartData.returnRateData, color: '#E24B4A' },
                  { label: 'معدل التوصيل', data: chartData.deliveryRateData, color: '#1D9E75' },
                  { label: 'MA7 (توصيل)', data: chartData.ma7Data, color: '#378ADD', borderDash: [5, 5] },
                  { label: 'MA30 (توصيل)', data: chartData.ma30Data, color: '#999', borderDash: [3, 3] },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!chartData && (
        <Card>
          <CardContent className="py-12 text-center text-[var(--color-text-muted)]">
            لا توجد بيانات كافية. احفظ نقاط بيانات يومية لظهور الاتجاهات.
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--color-text-muted)]">
          {snapshots.length} يوم محفوظ
          {snapshots.length > 0 && ` | آخر تحديث: ${snapshots[snapshots.length - 1]?.date}`}
        </div>
        {!todaySaved && (
          <Button onClick={saveToday} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            حفظ snapshot اليوم
          </Button>
        )}
        {todaySaved && (
          <span className="text-xs text-[var(--color-success)] font-medium">
            ✓ تم حفظ اليوم
          </span>
        )}
      </div>
    </div>
  );
}
