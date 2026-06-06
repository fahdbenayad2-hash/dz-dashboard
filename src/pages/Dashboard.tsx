import { useMemo, useState } from 'react';
import { ShoppingBag, DollarSign, CheckCircle, XCircle, BarChart3, Wallet, AlarmClock, Package } from 'lucide-react';
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
  getTrackingMetrics, getTrackingStatusDistribution, getAgentCountsTracking, getWilayaCountsTracking, getProductCountsTracking, getMonthlyRevenueTracking, getDailyRevenueTracking, getTodayOrders,
} from '@/lib/dashboardMetrics';

function useDashboardData(orders: Order[], tracking: TrackingOrder[]) {
  return useMemo(() => {
    const metrics = getOrderMetrics(orders);
    const trackingMetrics = getTrackingMetrics(tracking);
    const trackingStatus = getTrackingStatusDistribution(tracking);
    const today = getTodayOrders(orders);
    const agentData = getAgentCountsTracking(tracking);
    const wilayaData = getWilayaCountsTracking(tracking);
    const productData = getProductCountsTracking(tracking);
    const monthlyData = getMonthlyRevenueTracking(tracking);
    const revenueTrend = getDailyRevenueTracking(tracking, 14);

    console.log('[DZ-CHANGE] tracking-metrics', trackingMetrics);
    console.log('[DZ-CHANGE] today-orders', today);

    return {
      ...trackingMetrics,
      ...today,
      trackingStatus,
      agentData, wilayaData, productData,
      monthlyLabels: monthlyData.map(d => d[0]),
      monthlyOrders: monthlyData.map(d => d[1].orders),
      monthlyRevenue: monthlyData.map(d => d[1].revenue),
      last14Days: revenueTrend.map(d => d.date),
      dailyRevenue: revenueTrend.map(d => d.revenue),
      dailyOrders: revenueTrend.map(d => d.orders),
      pendingOrders: metrics.totalOrders,
    };
  }, [orders, tracking]);
}

export function Dashboard({ orders, trackingOrders }: { orders: Order[]; trackingOrders: TrackingOrder[] }) {
  console.log('[DZ-DASHBOARD] orders:', orders.length, 'trackingOrders:', trackingOrders.length);
  console.log('[DZ-DASHBOARD] first trackingOrder:', trackingOrders[0]);
  const data = useDashboardData(orders, trackingOrders);
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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPICard icon={<ShoppingBag className="h-5 w-5" />} label="إجمالي الطلبات (مؤكدة)" value={formatNumber(data.total)} change={0} />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="إجمالي الإيراد" value={formatCurrency(data.totalRevenue)} change={2.3} color="#1D9E75" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="تم التوصيل" value={formatNumber(data.delivered)} change={1.1} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="المرتجعات" value={formatNumber(data.returned)} change={-0.5} color="#E24B4A" />
        <KPICard icon={<BarChart3 className="h-5 w-5" />} label="متوسط قيمة الطلب" value={formatCurrency(data.avgOrderValue)} change={0.8} color="#7F77DD" />
        <KPICard icon={<Wallet className="h-5 w-5" />} label="صافي بعد الشحن" value={formatCurrency(data.netRevenue)} change={1.5} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPICard icon={<AlarmClock className="h-5 w-5" />} label="طلبات اليوم (جديدة)" value={formatNumber(data.ordersToday)} color="#378ADD" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="مداخيل اليوم" value={formatCurrency(data.revenueToday)} color="#1D9E75" />
        <KPICard icon={<Package className="h-5 w-5" />} label="قيد التوصيل" value={formatNumber(data.inTransit + data.inDelivery)} color="#EF9F27" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="معدل التوصيل" value={data.deliveryRate.toFixed(1) + '%'} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="معدل الإرجاع" value={data.returnRate.toFixed(1) + '%'} color="#E24B4A" />
        <KPICard icon={<ShoppingBag className="h-5 w-5" />} label="معلق (غير مؤكد)" value={formatNumber(data.pendingOrders)} color="#7F77DD" />
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
