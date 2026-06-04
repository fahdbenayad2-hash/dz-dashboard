import { useMemo } from 'react';
import { ShoppingCart, DollarSign, CheckCircle, XCircle, BarChart3, TrendingUp, Clock } from 'lucide-react';
import type { Order } from '@/types';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  getOrderMetrics, getStatusDistribution, getDailyConfirmedRevenue,
  filterLastDays, getDateISOString, parseOrderDate,
} from '@/lib/dashboardMetrics';

export function MonthlyReport({ orders }: { orders: Order[] }) {
  console.log('[DZ-CHANGE] MR_FIRST_ORDER', orders[0]);
  console.log('[DZ-CHANGE] MR_ORDER_KEYS', Object.keys(orders[0] || {}));

  const reportData = useMemo(() => {
    const last30 = filterLastDays(orders, 30);
    const metrics = getOrderMetrics(last30);
    const statusDist = getStatusDistribution(last30);
    const revenueTrend = getDailyConfirmedRevenue(last30, 30);

    const dailyCounts = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const day = getDateISOString(d);
      const count = last30.filter(o => {
        const od = parseOrderDate(o.date);
        return od && getDateISOString(od) === day;
      }).length;
      return count;
    });

    const labels30 = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return getDateISOString(d).slice(5);
    });

    const confirmationRate = metrics.totalOrders > 0
      ? (metrics.confirmedOrders / metrics.totalOrders) * 100
      : 0;

    const now = new Date();
    const mid = new Date(now);
    mid.setDate(mid.getDate() - 15);

    const current15 = last30.filter(o => {
      const d = parseOrderDate(o.date);
      return d && d >= mid;
    });
    const previous15 = last30.filter(o => {
      const d = parseOrderDate(o.date);
      return d && d < mid;
    });

    const currentRevenue = current15.reduce((s, o) => s + o.total, 0);
    const previousRevenue = previous15.reduce((s, o) => s + o.total, 0);
    const growth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    console.log('[DZ-CHANGE] monthly-report-metrics', {
      totalOrders: metrics.totalOrders,
      confirmedOrders: metrics.confirmedOrders,
      failedOrders: metrics.failedOrders,
      grossRevenue: metrics.grossRevenue,
      confirmedRevenue: metrics.confirmedRevenue,
      averageOrderValue: metrics.averageOrderValue,
      confirmationRate,
      cancellationRate: metrics.cancellationRate,
      growth,
    });

    return {
      metrics, statusDist, revenueTrend, dailyCounts, labels30,
      confirmationRate, growth, currentRevenue, previousRevenue,
    };
  }, [orders]);

  const r = reportData;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-xl font-bold text-[var(--color-text)]">تقرير الشهر الأخير</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KPICard icon={<ShoppingCart className="h-5 w-5" />} label="إجمالي الطلبات" value={formatNumber(r.metrics.totalOrders)} />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="المؤكدة" value={formatNumber(r.metrics.confirmedOrders)} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="الفاشلة" value={formatNumber(r.metrics.failedOrders)} color="#E24B4A" />
        <KPICard icon={<BarChart3 className="h-5 w-5" />} label="قيد الانتظار" value={formatNumber(r.metrics.pendingOrders)} color="#EF9F27" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="بانتظار" value={formatNumber(r.metrics.waitingOrders)} color="#7F77DD" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="الإيراد الإجمالي" value={formatCurrency(r.metrics.grossRevenue)} color="#1D9E75" />
      </div>

      {/* Revenue + Confirmation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>الإيراد المؤكد</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">
              {formatCurrency(r.metrics.confirmedRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>متوسط قيمة الطلب</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
              {formatCurrency(r.metrics.averageOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>معدل التأكيد</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
              {formatPercent(r.confirmationRate)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              معدل الإلغاء: {formatPercent(r.metrics.cancellationRate)}
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
                datasets={[{ label: 'الإيراد المؤكد', data: r.revenueTrend.map(d => d.revenue), color: '#1D9E75' }]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>توزيع حالات الطلبات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <DonutChart
                labels={['مؤكد', 'فاشل', 'قيد الانتظار', 'بانتظار']}
                values={[
                  r.statusDist.find(s => s.status === 'Confirmed')!.value,
                  r.statusDist.find(s => s.status === 'Failed')!.value,
                  r.statusDist.find(s => s.status === 'Pending')!.value,
                  r.statusDist.find(s => s.status === 'Waiting')!.value,
                ]}
              />
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
                <p className="text-xs text-[var(--color-text-muted)]">معدل التأكيد</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-success)]">
                  {formatPercent(r.confirmationRate)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">معدل الإلغاء</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-danger)]">
                  {formatPercent(r.metrics.cancellationRate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
