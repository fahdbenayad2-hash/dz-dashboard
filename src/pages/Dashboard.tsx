import { useMemo, useState } from 'react';
import { ShoppingCart, DollarSign, CheckCircle, XCircle, BarChart3, Wallet } from 'lucide-react';
import type { Order } from '@/types';
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
import { getOrderMetrics, getStatusDistribution, getDailyConfirmedRevenue, getAgentOrderCounts, getTopWilayas, getTopProducts, normalizeStatus } from '@/lib/dashboardMetrics';

function useDashboardData(orders: Order[]) {
  return useMemo(() => {
    const metrics = getOrderMetrics(orders);
    const statusDist = getStatusDistribution(orders);
    const statusCounts = {
      Confirmed: statusDist.find(s => s.status === 'Confirmed')!.value,
      Failed: statusDist.find(s => s.status === 'Failed')!.value,
      Pending: statusDist.find(s => s.status === 'Pending')!.value,
      Waiting: statusDist.find(s => s.status === 'Waiting')!.value,
    };
    const agentData = getAgentOrderCounts(orders);
    const wilayaData = getTopWilayas(orders);
    const productData = getTopProducts(orders);
    const revenueTrend = getDailyConfirmedRevenue(orders, 14);

    console.log('[DZ-CHANGE] cancellation-rate', {
      totalOrders: metrics.totalOrders,
      failedOrders: metrics.failedOrders,
      cancellationRate: metrics.cancellationRate,
    });
    console.log('[DZ-CHANGE] confirmed-orders', metrics.confirmedOrders);

    return {
      total: metrics.totalOrders,
      revenue: metrics.grossRevenue,
      confirmed: metrics.confirmedOrders,
      cancelRate: metrics.cancellationRate,
      avgOrder: metrics.averageOrderValue || (metrics.totalOrders > 0 ? metrics.grossRevenue / metrics.totalOrders : 0),
      netAfterDelivery: metrics.netAfterDelivery,
      agentData, statusCounts, wilayaData, productData,
      last14Days: revenueTrend.map(d => d.date),
      dailyRevenue: revenueTrend.map(d => d.revenue),
    };
  }, [orders]);
}

export function Dashboard({ orders }: { orders: Order[] }) {
  console.log('[DZ-CHANGE] FIRST_ORDER', orders[0]);
  console.log('[DZ-CHANGE] ORDER_KEYS', Object.keys(orders[0] || {}));
  if (orders.length > 0) {
    for (let i = 0; i < Math.min(5, orders.length); i++) {
      console.log('[DZ-CHANGE] ORDER_' + i, {
        status: orders[i].status,
        date: orders[i].date,
        total: orders[i].total,
      });
    }
    console.log('[DZ-CHANGE] normalized-status-sample', orders.slice(0, 10).map(o => ({
      raw: o.status,
      normalized: normalizeStatus(o.status),
    })));
  }
  const data = useDashboardData(orders);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard icon={<ShoppingCart className="h-5 w-5" />} label="إجمالي الطلبات" value={formatNumber(data.total)} change={0} />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="إجمالي الإيراد" value={formatCurrency(data.revenue)} change={2.3} color="#1D9E75" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="الطلبات المؤكدة" value={formatNumber(data.confirmed)} change={1.1} color="#1D9E75" />
        <KPICard icon={<XCircle className="h-5 w-5" />} label="معدل الإلغاء" value={data.cancelRate.toFixed(1) + '%'} change={-0.5} color="#E24B4A" />
        <KPICard icon={<BarChart3 className="h-5 w-5" />} label="متوسط قيمة الطلب" value={formatCurrency(data.avgOrder)} change={0.8} color="#7F77DD" />
        <KPICard icon={<Wallet className="h-5 w-5" />} label="صافي بعد الشحن" value={formatCurrency(data.netAfterDelivery)} change={1.5} />
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
          <CardHeader><CardTitle>حالة الطلبات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {(data.statusCounts.Confirmed + data.statusCounts.Failed + data.statusCounts.Pending + data.statusCounts.Waiting) > 0 && (
                <DonutChart
                  labels={['مؤكد', 'فاشل', 'قيد الانتظار', 'بانتظار']}
                  values={[data.statusCounts.Confirmed, data.statusCounts.Failed, data.statusCounts.Pending, data.statusCounts.Waiting]}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>أفضل 10 ولايات</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>أفضل 6 منتجات (حسب الإيراد)</CardTitle></CardHeader>
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

      {/* Revenue Trend */}
      <Card>
        <CardHeader><CardTitle>اتجاه الإيرادات (آخر 14 يوم)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <LineChart
              labels={data.last14Days}
              datasets={[
                { label: 'الإيراد المؤكد', data: data.dailyRevenue, color: '#1D9E75' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

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
