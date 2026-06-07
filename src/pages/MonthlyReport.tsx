import { useMemo, useState } from 'react';
import { Package, DollarSign, CheckCircle, XCircle, BarChart3, TrendingUp, TrendingDown, Timer, CalendarDays } from 'lucide-react';
import type { TrackingOrder } from '@/types';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  isValidDate, getDateISOString,
  getTrackingMetrics, getTrackingStatusDistribution, getProductCountsTracking, getWilayaCountsTracking,
  getMonthlyBreakdown, getAvailableMonths, getLast3MonthsSummary, formatMonthLabel,
} from '@/lib/dashboardMetrics';

export function MonthlyReport({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const availableMonths = useMemo(() => getAvailableMonths(trackingOrders), [trackingOrders]);

  const last3 = useMemo(() => getLast3MonthsSummary(trackingOrders), [trackingOrders]);

  const monthly = useMemo(() => {
    if (!selectedMonth) return null;
    return getMonthlyBreakdown(trackingOrders, selectedMonth);
  }, [trackingOrders, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-xl font-bold text-[var(--color-text)]">تقارير الأشهر</h1>
      </div>

      {/* Section A: Last 3 Months Summary */}
      <Card>
        <CardHeader><CardTitle>ملخص آخر 3 أشهر</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {last3.map((m, i) => {
              const prev = i < last3.length - 1 ? last3[i + 1] : null;
              const orderChange = prev && prev.total > 0 ? ((m.total - prev.total) / prev.total) * 100 : 0;
              const revChange = prev && prev.totalRevenue > 0 ? ((m.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100 : 0;
              return (
                <Card key={m.month}>
                  <CardContent className="p-4 space-y-3">
                    <p className="font-bold text-[var(--color-text)]">{formatMonthLabel(m.month)}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">الطلبات</span>
                        <span className="font-medium tabular-nums">{formatNumber(m.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">تم التوصيل</span>
                        <span className="font-medium tabular-nums text-[var(--color-success)]">{formatNumber(m.delivered)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">المرتجعات</span>
                        <span className="font-medium tabular-nums text-[var(--color-danger)]">{formatNumber(m.returned)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">معدل التوصيل</span>
                        <span className="font-medium tabular-nums">{formatPercent(m.deliveryRate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">الإيراد</span>
                        <span className="font-medium tabular-nums">{formatCurrency(m.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">صافي الإيراد</span>
                        <span className="font-medium tabular-nums text-[var(--color-success)]">{formatCurrency(m.netRevenue)}</span>
                      </div>
                    </div>
                    {i > 0 && (
                      <div className="pt-2 border-t border-[var(--color-border)] space-y-1 text-xs">
                        <div className="flex items-center gap-1">
                          {orderChange >= 0 ? <TrendingUp className="h-3 w-3 text-[var(--color-success)]" /> : <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />}
                          <span className={orderChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                            الطلبات: {orderChange >= 0 ? '+' : ''}{orderChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {revChange >= 0 ? <TrendingUp className="h-3 w-3 text-[var(--color-success)]" /> : <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />}
                          <span className={revChange >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                            الإيراد: {revChange >= 0 ? '+' : ''}{revChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section B: Selected Month Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>تقرير الشهر</CardTitle>
            <Select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-48">
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        {monthly && (
          <CardContent className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <KPICard icon={<Package className="h-5 w-5" />} label="إجمالي الطلبات" value={formatNumber(monthly.metrics.total)} />
              <KPICard icon={<CheckCircle className="h-5 w-5" />} label="تم التوصيل" value={formatNumber(monthly.metrics.delivered)} color="#1D9E75" />
              <KPICard icon={<XCircle className="h-5 w-5" />} label="مرتجع" value={formatNumber(monthly.metrics.returned)} color="#E24B4A" />
              <KPICard icon={<Package className="h-5 w-5" />} label="قيد التوصيل" value={formatNumber(monthly.metrics.inTransit)} color="#EF9F27" />
              <KPICard icon={<DollarSign className="h-5 w-5" />} label="الإيراد" value={formatCurrency(monthly.metrics.totalRevenue)} color="#378ADD" />
              <KPICard icon={<DollarSign className="h-5 w-5" />} label="صافي الإيراد" value={formatCurrency(monthly.metrics.netRevenue)} color="#1D9E75" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>معدل التوصيل</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">
                    {formatPercent(monthly.metrics.deliveryRate)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>معدل الإرجاع</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-[var(--color-danger)]">
                    {formatPercent(monthly.metrics.returnRate)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>متوسط قيمة الطلب</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
                    {formatCurrency(monthly.metrics.avgOrderValue)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>اتجاه الطلبات اليومي</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-72">
                    <LineChart
                      labels={monthly.dailyTrend.map(d => d.date.slice(5))}
                      datasets={[{ label: 'الطلبات', data: monthly.dailyTrend.map(d => d.orders), color: '#378ADD' }]}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>اتجاه الإيرادات اليومي</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-72">
                    <LineChart
                      labels={monthly.dailyTrend.map(d => d.date.slice(5))}
                      datasets={[{ label: 'الإيراد', data: monthly.dailyTrend.map(d => d.revenue), color: '#1D9E75' }]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader><CardTitle>توزيع حالات التتبع</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    {(monthly.statusDist.delivered + monthly.statusDist.returned + monthly.statusDist.inTransit + monthly.statusDist.inDelivery + monthly.statusDist.others) > 0 && (
                      <DonutChart
                        labels={['تم التوصيل', 'مرتجع', 'قيد التوصيل', 'جاري التوزيع', 'أخرى']}
                        values={[monthly.statusDist.delivered, monthly.statusDist.returned, monthly.statusDist.inTransit, monthly.statusDist.inDelivery, monthly.statusDist.others]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>أفضل 10 منتجات</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    {monthly.topProducts.length > 0 && (
                      <BarChart
                        labels={monthly.topProducts.map(p => p[0]).reverse()}
                        values={monthly.topProducts.map(p => p[1]).reverse()}
                        color="#1D9E75"
                        horizontal
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>أفضل 10 ولايات</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    {monthly.topWilayas.length > 0 && (
                      <BarChart
                        labels={monthly.topWilayas.map(w => w[0]).reverse()}
                        values={monthly.topWilayas.map(w => w[1]).reverse()}
                        color="#378ADD"
                        horizontal
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
