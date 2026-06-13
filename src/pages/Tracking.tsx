import { useMemo, useState } from 'react';
import type { TrackingOrder } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getTrackingMetrics, getTrackingStatusDistribution } from '@/lib/dashboardMetrics';
import { Truck, CheckCircle, XCircle, Clock, HelpCircle, Repeat } from 'lucide-react';

const categoryConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'default' | 'outline'; icon: typeof Truck }> = {
  delivered: { label: 'تم التوصيل', variant: 'success', icon: CheckCircle },
  returned: { label: 'مرتجع', variant: 'danger', icon: XCircle },
  transit: { label: 'قيد التوصيل', variant: 'warning', icon: Clock },
  delivery: { label: 'جاري التوزيع', variant: 'default', icon: Truck },
  others: { label: 'أخرى', variant: 'outline', icon: HelpCircle },
};

export function Tracking({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;

  const deliveredCounts = useMemo(() => {
    const map = new Map<string, number>();
    trackingOrders
      .filter(t => t.statusCategory === 'delivered')
      .forEach(t => map.set(t.customer, (map.get(t.customer) || 0) + 1));
    return map;
  }, [trackingOrders]);

  const repeatDelivered = useMemo(() => {
    const set = new Set<string>();
    deliveredCounts.forEach((count, customer) => { if (count >= 2) set.add(customer); });
    return set;
  }, [deliveredCounts]);

  const stats = useMemo(() => getTrackingMetrics(trackingOrders), [trackingOrders]);
  const statusDist = useMemo(() => getTrackingStatusDistribution(trackingOrders), [trackingOrders]);

  const filtered = useMemo(() => {
    let list = [...trackingOrders];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.customer.toLowerCase().includes(q) ||
        t.wilaya.toLowerCase().includes(q) ||
        t.product.toLowerCase().includes(q) ||
        t.orderId.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.statusCategory === categoryFilter);
    }
    if (repeatOnly) {
      list = list.filter(t => t.statusCategory === 'delivered' && repeatDelivered.has(t.customer));
    }
    if (repeatOnly) {
      return list.sort((a, b) => (deliveredCounts.get(b.customer) || 0) - (deliveredCounts.get(a.customer) || 0));
    }
    return list.sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : 0;
      const bTime = b.date ? b.date.getTime() : 0;
      return bTime - aTime;
    });
  }, [trackingOrders, search, categoryFilter, repeatOnly, repeatDelivered, deliveredCounts]);

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">الإجمالي</p>
          <p className="text-xl font-bold tabular-nums">{formatNumber(stats.total)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]" style={{ color: '#1D9E75' }}>تم التوصيل</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#1D9E75' }}>{formatNumber(stats.delivered)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]" style={{ color: '#E24B4A' }}>مرتجع</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#E24B4A' }}>{formatNumber(stats.returned)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]" style={{ color: '#EF9F27' }}>قيد التوصيل</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#EF9F27' }}>{formatNumber(stats.inTransit)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]" style={{ color: '#378ADD' }}>جاري التوزيع</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#378ADD' }}>{formatNumber(stats.inDelivery)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">صافي الإيراد</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#1D9E75' }}>{formatCurrency(stats.netRevenue)}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>سجل التتبع ({formatNumber(filtered.length)})</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant={repeatOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setRepeatOnly(v => !v); setPage(0); }}
                className="gap-1.5"
              >
                <Repeat className="h-4 w-4" />
                {repeatOnly ? 'تم التوصيل (متكرر)' : `تم التوصيل (${repeatDelivered.size})`}
              </Button>
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="w-48"
              />
              <Select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}>
                <option value="all">جميع الحالات</option>
                <option value="delivered">تم التوصيل</option>
                <option value="returned">مرتجع</option>
                <option value="transit">قيد التوصيل</option>
                <option value="delivery">جاري التوزيع</option>
                <option value="others">أخرى</option>
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
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الوكيل</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>الولاية</TableHead>
                  <TableHead>حالة التتبع</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الشحن</TableHead>
                  <TableHead>السائق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(t => {
                  const cfg = categoryConfig[t.statusCategory] || categoryConfig.others;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={t.orderId}>
                      <TableCell className="font-medium tabular-nums">{t.orderId}</TableCell>
                      <TableCell className="tabular-nums">{t.date ? t.date.toLocaleDateString('ar-DZ') : '-'}</TableCell>
                      <TableCell>{t.agent}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {t.customer}
                          {deliveredCounts.get(t.customer)! >= 2 && (
                            <Badge variant="success" className="text-[10px] px-1 py-0">{deliveredCounts.get(t.customer)}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{t.wilaya}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Badge variant={cfg.variant}>
                            <Icon className="h-3 w-3 ml-1" />
                            {cfg.label}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">{t.product}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(t.total)}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(t.delivery)}</TableCell>
                      <TableCell>{t.driver || '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-[var(--color-text-muted)] py-8">
                      لا توجد بيانات تتبع
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
                <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-50" disabled={page === 0} onClick={() => setPage(p => p - 1)}>السابق</button>
                <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-50" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>التالي</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
