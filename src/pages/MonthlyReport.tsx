import { useMemo } from 'react';
import { ShoppingCart, DollarSign, CheckCircle, XCircle, BarChart3, TrendingUp, Clock, Truck } from 'lucide-react';
import type { Order, TrackingOrder } from '@/types';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  getDateISOString, parseOrderDate,
  getTrackingMetrics, getTrackingStatusDistribution, getMonthlyRevenueTracking, getDailyRevenueTracking, filterTrackingLastDays,
} from '@/lib/dashboardMetrics';

export function MonthlyReport({ orders, trackingOrders }: { orders: Order[]; trackingOrders: TrackingOrder[] }) {
  const reportData = useMemo(() => {
    const last30 = filterTrackingLastDays(trackingOrders, 30);
    const metrics = getTrackingMetrics(last30);
    const statusDist = getTrackingStatusDistribution(last30);
    const revenueTrend = getDailyRevenueTracking(last30, 30);
    const monthlyData = getMonthlyRevenueTracking(trackingOrders);

    const dailyCounts = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const day = getDateISOString(d);
      return last30.filter(t => t.date && getDateISOString(t.date) === day).length;
    });

    const labels30 = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return getDateISOString(d).slice(5);
    });

    const now = new Date();
    const mid = new Date(now);
    mid.setDate(mid.getDate() - 15);

    const current15 = last30.filter(t => t.date && t.date >= mid);
    const previous15 = last30.filter(t => t.date && t.date < mid);

    const currentRevenue = current15.reduce((s, t) => s + t.total, 0);
    const previousRevenue = previous15.reduce((s, t) => s + t.total, 0);
    const growth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const pendingCount = orders.length;

    console.log('[DZ-CHANGE] monthly-report-metrics', {
      totalOrders: metrics.total,
      deliveredOrders: metrics.delivered,
      returnedOrders: metrics.returned,
      totalRevenue: metrics.totalRevenue,
      netRevenue: metrics.netRevenue,
      averageOrderValue: metrics.avgOrderValue,
      deliveryRate: metrics.deliveryRate,
      returnRate: metrics.returnRate,
      growth,
    });

    return {
      metrics, statusDist, revenueTrend, dailyCounts, labels30,
      growth, currentRevenue, previousRevenue, monthlyData, pendingCount,
    };
  }, [orders, trackingOrders]);

  const r = reportData;
  const statusLabels = ['تم التوصيل', 'مرتجع', 'قيد التوصيل', 'جاري التوزيع', 'أخرى'];
  const statusValues = [r.statusDist.delivered, r.statusDist.returned, r.statusDist.inTransit, r.statusDist.inDelivery, r.statusDist.others];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-xl font-bold text-[var(--color-text)]">تقرير الشهر الأخير</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KPICard icon={<ShoppingCart className="h-5 w-5" />} label="إجمالي الطلبات" value={formatNumber(r.metrics.total)} />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="تم التوصيل" value={formatNumber(r.metrics.delivered)} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="المرتجعات" value={formatNumber(r.metrics.returned)} color="#E24B4A" />
        <KPICard icon={<Truck className="h-5 w-5" />} label="قيد التوصيل" value={formatNumber(r.metrics.inTransit)} color="#EF9F27" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="معلق (غير مؤكد)" value={formatNumber(r.pendingCount)} color="#7F77DD" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="صافي الإيراد" value={formatCurrency(r.metrics.netRevenue)} color="#1D9E75" />
      </div>

      {/* Revenue + Rates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>الإيراد الإجمالي (30 يوم)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">
              {formatCurrency(r.metrics.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>متوسط قيمة الطلب</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
              {formatCurrency(r.metrics.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>معدل التوصيل</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">
              {formatPercent(r.metrics.deliveryRate)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              معدل الإرجاع: {formatPercent(r.metrics.returnRate)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>اتجاه الطلبات (30 يوم)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={r.labels30}
                datasets={[{ label: 'عدد الطلبات', data: r.dailyCounts }]}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>اتجاه الإيرادات (30 يوم)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={r.labels30}
                datasets={[{ label: 'الإيراد', data: r.revenueTrend.map(d => d.revenue), color: '#1D9E75' }]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>توزيع حالات التتبع</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {(statusValues.some(v => v > 0)) && (
                <DonutChart labels={statusLabels} values={statusValues} />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>ملخص النمو</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm text-[var(--color-text-muted)]">مقارنة النصفين (15 يوم / 15 يوم)</p>
              <div className="flex items-end gap-4 mt-2">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">الأولى</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(r.previousRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">الثانية</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(r.currentRevenue)}</p>
                </div>
                <div className="mr-auto">
                  <p className="text-xs text-[var(--color-text-muted)]">نسبة النمو</p>
                  <p className={`text-2xl font-bold tabular-nums ${r.growth >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {r.growth >= 0 ? '+' : ''}{r.growth.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">معدل التوصيل</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-success)]">
                  {formatPercent(r.metrics.deliveryRate)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">معدل الإرجاع</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-danger)]">
                  {formatPercent(r.metrics.returnRate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
