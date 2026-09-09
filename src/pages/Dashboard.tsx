import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CircleAlert, DollarSign, ShoppingCart, Trophy, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Order, TrackingOrder } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  getOrderMetrics, normalizeStatus,
  getTrackingMetrics, getTrackingStatusDistribution, getAgentCountsTracking, getWilayaCountsTracking, getProductCountsTracking, getMonthlyRevenueTracking, getDailyRevenueTracking,
  getPeriodOrders, getPeriodDelivered, getPeriodRevenue, filterByPeriod,
  getSettledMetrics,
} from '@/lib/dashboardMetrics';

function toInputDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function useDashboardData(orders: Order[], tracking: TrackingOrder[], fromStr: string, toStr: string) {
  return useMemo(() => {
    const dateFrom = new Date(fromStr + 'T00:00:00');
    const dateTo = new Date(toStr + 'T23:59:59');
    const periodOrders = getPeriodOrders(orders, dateFrom, dateTo);
    const periodDelivered = getPeriodDelivered(tracking, dateFrom, dateTo);
    const periodRevenue = getPeriodRevenue(tracking, dateFrom, dateTo);
    const periodTracking = filterByPeriod(tracking, dateFrom, dateTo);
    const metrics = getOrderMetrics(orders);
    const trackingMetrics = getTrackingMetrics(periodTracking);
    const trackingStatus = getTrackingStatusDistribution(periodTracking);
    const agentData = getAgentCountsTracking(periodTracking);
    const wilayaData = getWilayaCountsTracking(periodTracking);
    const productData = getProductCountsTracking(periodTracking);
    const monthlyData = getMonthlyRevenueTracking(tracking);
    const daysInPeriod = Math.max(Math.floor((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);
    const revenueTrend = getDailyRevenueTracking(periodTracking, daysInPeriod, dateTo);
    const settledMetrics = getSettledMetrics(periodTracking);

    // Best product in period
    const prodMap = new Map<string, { orders: number; revenue: number }>();
    periodTracking
      .filter(t => t.statusCategory === 'delivered' && t.product)
      .forEach(t => {
        const e = prodMap.get(t.product!) || { orders: 0, revenue: 0 };
        e.orders++;
        e.revenue += t.total;
        prodMap.set(t.product!, e);
      });
    const topProduct = [...prodMap.entries()]
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 1)
      .map(([name, d]) => ({ name, ...d }))[0] || null;


    return {
      ...trackingMetrics,
      deliveredToday: periodDelivered,
      ...periodOrders,
      periodRevenue,
      topProduct,
      trackingStatus,
      agentData, wilayaData, productData,
      settledMetrics,
      monthlyLabels: monthlyData.map(d => d[0]),
      monthlyOrders: monthlyData.map(d => d[1].orders),
      monthlyRevenue: monthlyData.map(d => d[1].revenue),
      last14Days: revenueTrend.map(d => d.date),
      dailyRevenue: revenueTrend.map(d => d.revenue),
      dailyOrders: revenueTrend.map(d => d.orders),
      pendingOrders: metrics.pendingOrders,
    };
  }, [orders, tracking, fromStr, toStr]);
}

export function Dashboard({ orders, trackingOrders }: { orders: Order[]; trackingOrders: TrackingOrder[] }) {
  const [dateFrom, setDateFrom] = useState(() => toInputDate(new Date()));
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const data = useDashboardData(orders, trackingOrders, dateFrom, dateTo);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const perPage = 10;

  const recentOrders = useMemo(() => {
    let list = [...orders];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.customer.toLowerCase().includes(q) ||
        o.wilaya.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter(o => normalizeStatus(o.status) === statusFilter);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, search, statusFilter]);

  const pagedOrders = recentOrders.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(recentOrders.length / perPage);

  return (
    <div className="space-y-6">
      <Card className="p-3 shadow-sm sm:p-4 xl:sticky xl:top-20 xl:z-10">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold">فترة التحليل</p>
            <p className="text-xs text-[var(--color-text-muted)]">تطبّق على مؤشرات ورسوم هذه الصفحة</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="dashboard-from">من تاريخ</label>
            <Input id="dashboard-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="min-h-10 w-[9.5rem]" />
            <span className="text-xs text-[var(--color-text-muted)]">إلى</span>
            <label className="sr-only" htmlFor="dashboard-to">إلى تاريخ</label>
            <Input id="dashboard-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="min-h-10 w-[9.5rem]" />
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => { const d = new Date(); setDateFrom(toInputDate(d)); setDateTo(toInputDate(d)); }}>اليوم</Button>
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => { const d = new Date(); const weekAgo = new Date(); weekAgo.setDate(d.getDate() - 6); setDateFrom(toInputDate(weekAgo)); setDateTo(toInputDate(d)); }}>7 أيام</Button>
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => { const d = new Date(); const monthAgo = new Date(); monthAgo.setDate(d.getDate() - 29); setDateFrom(toInputDate(monthAgo)); setDateTo(toInputDate(d)); }}>30 يوماً</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PrimaryMetric icon={<ShoppingCart className="h-5 w-5" />} label="الطلبات الجديدة" value={formatNumber(data.ordersToday)} hint="خلال الفترة المحددة" tone="primary" />
        <PrimaryMetric icon={<Truck className="h-5 w-5" />} label="معدل التوصيل" value={`${data.settledMetrics.deliveryRate.toFixed(1)}%`} hint={`من ${formatNumber(data.settledMetrics.settledCount)} طلب محسوم`} tone="success" />
        <PrimaryMetric icon={<DollarSign className="h-5 w-5" />} label="إيراد المسلّم" value={formatCurrency(data.periodRevenue)} hint="للطلبات المسلّمة فقط" tone="success" />
        <PrimaryMetric icon={<CircleAlert className="h-5 w-5" />} label="تحتاج تدخلاً" value={formatNumber(data.pendingOrders)} hint="طلبات غير مؤكدة حالياً" tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card>
          <CardHeader className="border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-3"><div><CardTitle>إجراءات مطلوبة</CardTitle><p className="mt-1 text-xs text-[var(--color-text-muted)]">أهم القوائم التي تستحق المتابعة الآن</p></div><CircleAlert className="h-5 w-5 text-[var(--color-danger)]" /></div>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--color-border)] p-0">
            <ActionRow to="/orders" label="طلبات معلقة غير مؤكدة" value={data.pendingOrders} tone="danger" />
            <ActionRow to="/tracking" label="حالات تتبع غير مصنّفة" value={data.trackingStatus.others} tone="warning" />
            <ActionRow to="/tracking" label="مرتجعات في الفترة" value={data.returned} tone="danger" />
          </CardContent>
        </Card>

        {data.topProduct && <Card className="overflow-hidden bg-[var(--color-primary)] text-white">
          <CardContent className="flex h-full flex-col justify-between gap-5">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Trophy className="h-5 w-5" /></span><div><p className="text-xs text-white/70">أفضل منتج في الفترة</p><p className="mt-1 line-clamp-2 font-bold">{data.topProduct.name}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-white/10 p-3"><p className="text-xs text-white/70">طلبات مسلّمة</p><p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(data.topProduct.orders)}</p></div><div className="rounded-lg bg-white/10 p-3"><p className="text-xs text-white/70">الإيراد</p><p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(data.topProduct.revenue)}</p></div></div>
          </CardContent>
        </Card>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">تفاصيل الفترة</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <CompactMetric label="طلبات التتبع" value={formatNumber(data.total)} />
          <CompactMetric label="تم التوصيل" value={formatNumber(data.delivered)} tone="success" />
          <CompactMetric label="المرتجعات" value={formatNumber(data.returned)} tone="danger" />
          <CompactMetric label="قيد التوصيل" value={formatNumber(data.inTransit + data.inDelivery)} tone="warning" />
          <CompactMetric label="قيمة كل الطلبات" value={formatCurrency(data.orderValue)} />
          <CompactMetric label="قيمة المسلّم دون الشحن" value={formatCurrency(data.netRevenue)} tone="success" />
          <CompactMetric label="متوسط الطلب المسلّم" value={formatCurrency(data.avgOrderValue)} />
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>أداء الوكلاء</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {data.agentData.length > 0 && (
                <BarChart
                  labels={data.agentData.map(d => d[0])}
                  values={data.agentData.map(d => d[1])}
                  color="#378ADD"
                />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>حالة التتبع</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {(data.trackingStatus.delivered + data.trackingStatus.returned + data.trackingStatus.inTransit + data.trackingStatus.inDelivery) > 0 && (
                <DonutChart
                  labels={['تم التوصيل', 'مرتجع', 'قيد التوصيل', 'جاري التوزيع', 'أخرى']}
                  values={[data.trackingStatus.delivered, data.trackingStatus.returned, data.trackingStatus.inTransit, data.trackingStatus.inDelivery, data.trackingStatus.others]}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>أفضل 15 ولاية</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {data.wilayaData.length > 0 && (
                <BarChart
                  labels={data.wilayaData.map(d => d[0])}
                  values={data.wilayaData.map(d => d[1])}
                  color="#1D9E75"
                  horizontal
                />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>أفضل 10 منتجات (حسب الإيراد)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {data.productData.length > 0 && (
                <BarChart
                  labels={data.productData.map(d => d[0].length > 15 ? d[0].slice(0, 15) + '...' : d[0])}
                  values={data.productData.map(d => d[1])}
                  color="#7F77DD"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>اتجاه الإيرادات (آخر 14 يوم)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={data.last14Days}
                datasets={[
                  { label: 'الإيراد', data: data.dailyRevenue, color: '#1D9E75' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الاتجاه الشهري (آخر 6 أشهر)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {data.monthlyLabels.length > 0 && (
                <BarChart
                  labels={data.monthlyLabels}
                  values={data.monthlyRevenue}
                  color="#378ADD"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>آخر الطلبات</CardTitle>
            <div className="flex items-center gap-3">
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="w-48"
              />
              <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
                <option value="all">جميع الحالات</option>
                <option value="Confirmed">مؤكد</option>
                <option value="Failed">فاشل</option>
                <option value="Pending">قيد الانتظار</option>
                <option value="Waiting">بانتظار</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>الولاية</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>رسوم الشحن</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الوكيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedOrders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium tabular-nums">{o.id}</TableCell>
                    <TableCell>{o.customer}</TableCell>
                    <TableCell>{o.wilaya}</TableCell>
                    <TableCell className="max-w-40 truncate">{o.product}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(o.delivery)}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.agent}</TableCell>
                  </TableRow>
                ))}
                {pagedOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[var(--color-text-muted)] py-8">
                      لا توجد طلبات
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-text-muted)]">
                الصفحة {page + 1} من {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  السابق
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  التالي
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PrimaryMetric({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'primary' | 'success' | 'danger' }) {
  const colors = {
    primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  };
  return <Card>
    <CardContent className="flex flex-col gap-4 p-0 sm:flex-row sm:items-center">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
        <span className="mt-1 block truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</span>
        <span className="mt-1 hidden truncate text-[11px] text-[var(--color-text-muted)] sm:block">{hint}</span>
      </span>
    </CardContent>
  </Card>;
}

function ActionRow({ to, label, value, tone }: { to: string; label: string; value: number; tone: 'danger' | 'warning' }) {
  return <Link to={to} className="flex min-h-14 items-center justify-between gap-4 px-1 py-3 transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
    <span className="text-sm font-medium">{label}</span>
    <span className="flex items-center gap-3">
      <span className={tone === 'danger' ? 'rounded-full bg-[var(--color-danger)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-danger)] tabular-nums' : 'rounded-full bg-[var(--color-warning)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-warning)] tabular-nums'}>{formatNumber(value)}</span>
      <ArrowLeft className="h-4 w-4 text-[var(--color-text-muted)]" />
    </span>
  </Link>;
}

function CompactMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const valueColor = tone === 'success' ? 'text-[var(--color-success)]' : tone === 'danger' ? 'text-[var(--color-danger)]' : tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]';
  return <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
    <p className="truncate text-[11px] text-[var(--color-text-muted)]">{label}</p>
    <p className={`mt-1 truncate text-base font-bold tabular-nums ${valueColor}`}>{value}</p>
  </div>;
}
