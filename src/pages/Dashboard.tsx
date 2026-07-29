import { useMemo, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, BarChart3, AlarmClock, Timer, Package, PackageCheck, PiggyBank } from 'lucide-react';
import type { Order, TrackingOrder } from '@/types';
import { KPICard } from '@/components/shared/KPICard';
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
  getPeriodOrders, getPeriodDelivered, getPeriodRevenue, filterByPeriod, getDateISOStringLocal, isValidDate,
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
    const daysInPeriod = Math.max(Math.round((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);
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

    console.log('[DZ-CHANGE] tracking-metrics', trackingMetrics);

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
  console.log('[DZ-DASHBOARD] orders:', orders.length, 'trackingOrders:', trackingOrders.length);
  console.log('[DZ-DASHBOARD] first trackingOrder:', trackingOrders[0]);
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
      list = list.filter(o => o.status === statusFilter);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, search, statusFilter]);

  const pagedOrders = recentOrders.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(recentOrders.length / perPage);

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">من</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">إلى</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(); setDateFrom(toInputDate(d)); setDateTo(toInputDate(d));
        }}>اليوم</Button>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(); const weekAgo = new Date(); weekAgo.setDate(d.getDate() - 7);
          setDateFrom(toInputDate(weekAgo)); setDateTo(toInputDate(d));
        }}>آخر 7 أيام</Button>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(); const monthAgo = new Date(); monthAgo.setDate(d.getDate() - 30);
          setDateFrom(toInputDate(monthAgo)); setDateTo(toInputDate(d));
        }}>آخر 30 يوم</Button>
      </div>

      {/* Top Product in Period */}
      {data.topProduct && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">المنتج الأكثر مبيعاً في الفترة</p>
                  <p className="text-lg font-bold">{data.topProduct.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">عدد الطلبات</p>
                  <p className="text-xl font-bold">{formatNumber(data.topProduct.orders)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">الإيراد</p>
                  <p className="text-xl font-bold">{formatCurrency(data.topProduct.revenue)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPICard icon={<PackageCheck className="h-5 w-5" />} label="إجمالي الطلبات (مؤكدة)" value={formatNumber(data.total)} change={0} />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="إجمالي الإيراد" value={formatCurrency(data.totalRevenue)} change={2.3} color="#1D9E75" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="تم التوصيل" value={formatNumber(data.delivered)} change={1.1} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="المرتجعات" value={formatNumber(data.returned)} change={-0.5} color="#E24B4A" />
        <KPICard icon={<BarChart3 className="h-5 w-5" />} label="متوسط قيمة الطلب" value={formatCurrency(data.avgOrderValue)} change={0.8} color="#7F77DD" />
        <KPICard icon={<PiggyBank className="h-5 w-5" />} label="صافي بعد الشحن" value={formatCurrency(data.netRevenue)} change={1.5} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPICard icon={<AlarmClock className="h-5 w-5" />} label="طلبات جديدة (الفترة)" value={formatNumber(data.ordersToday)} color="#378ADD" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="تم التوصيل (الفترة)" value={formatNumber(data.deliveredToday)} color="#1D9E75" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="إيراد (الفترة)" value={formatCurrency(data.periodRevenue)} color="#1D9E75" />
        <KPICard icon={<Package className="h-5 w-5" />} label="قيد التوصيل" value={formatNumber(data.inTransit + data.inDelivery)} color="#EF9F27" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="معدل التوصيل (محسوم)" value={data.settledMetrics.deliveryRate.toFixed(1) + '%'} change={0} changeLabel={`من ${formatNumber(data.settledMetrics.settledCount)} طلب`} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="معدل الإرجاع" value={data.returnRate.toFixed(1) + '%'} color="#E24B4A" />
        <KPICard icon={<Timer className="h-5 w-5" />} label="معلق (غير مؤكد)" value={formatNumber(data.pendingOrders)} color="#7F77DD" />
      </div>

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
