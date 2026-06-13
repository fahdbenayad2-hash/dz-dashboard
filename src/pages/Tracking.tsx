import { useMemo, useState } from 'react';
import type { TrackingOrder, Order } from '@/types';
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

export function Tracking({ orders = [], trackingOrders }: { orders?: Order[]; trackingOrders: TrackingOrder[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;

  const customerPhone = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => map.set(o.customer, o.phone));
    return map;
  }, [orders]);

  function getPhone(t: TrackingOrder): string {
    return customerPhone.get(t.customer) || t.customer;
  }

  const deliveredCounts = useMemo(() => {
    const map = new Map<string, number>();
    trackingOrders
      .filter(t => t.statusCategory === 'delivered')
      .forEach(t => {
        const key = getPhone(t);
        map.set(key, (map.get(key) || 0) + 1);
      });
    return map;
  }, [trackingOrders, customerPhone]);

  const repeatDelivered = useMemo(() => {
    const set = new Set<string>();
    deliveredCounts.forEach((count, key) => { if (count >= 2) set.add(key); });
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
        getPhone(t).toLowerCase().includes(q) ||
        t.wilaya.toLowerCase().includes(q) ||
        t.product.toLowerCase().includes(q) ||
        t.orderId.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.statusCategory === categoryFilter);
    }
    if (repeatOnly) {
      list = list.filter(t => t.statusCategory === 'delivered' && repeatDelivered.has(getPhone(t)));
    }
    if (repeatOnly) {
      return list.sort((a, b) => (deliveredCounts.get(getPhone(b)) || 0) - (deliveredCounts.get(getPhone(a)) || 0));
    }
    return list.sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : 0;
      const bTime = b.date ? b.date.getTime() : 0;
      return bTime - aTime;
    });
  }, [trackingOrders, search, categoryFilter, repeatOnly, repeatDelivered, deliveredCounts, customerPhone]);

  const customerSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalRevenue: number; totalDelivery: number; customers: Set<string>; orders: TrackingOrder[] }>();
    trackingOrders
      .filter(t => t.statusCategory === 'delivered')
      .forEach(t => {
        const key = getPhone(t);
        if (!repeatDelivered.has(key)) return;
        const entry = map.get(key);
        if (entry) {
          entry.count++;
          entry.totalRevenue += t.total;
          entry.totalDelivery += t.delivery;
          entry.customers.add(t.customer);
          entry.orders.push(t);
        } else {
          map.set(key, { count: 1, totalRevenue: t.total, totalDelivery: t.delivery, customers: new Set([t.customer]), orders: [t] });
        }
      });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [trackingOrders, repeatDelivered, customerPhone]);

  const paged = repeatOnly
    ? customerSummary.slice(page * perPage, (page + 1) * perPage)
    : filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil((repeatOnly ? customerSummary.length : filtered.length) / perPage);

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
            <CardTitle>{repeatOnly ? `الزبائن المتكررون (${formatNumber(customerSummary.length)})` : `سجل التتبع (${formatNumber(filtered.length)})`}</CardTitle>
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
                  {repeatOnly ? (
                    <>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>عدد الطلبيات</TableHead>
                      <TableHead>إجمالي الإيراد</TableHead>
                      <TableHead>إجمالي الشحن</TableHead>
                      <TableHead>آخر طلب</TableHead>
                      <TableHead>الولاية</TableHead>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {repeatOnly ? (
                  (paged as [string, { count: number; totalRevenue: number; totalDelivery: number; customers: Set<string>; orders: TrackingOrder[] }][]).map(([phone, data]) => {
                    const lastOrder = data.orders.reduce((latest, o) =>
                      o.date && (!latest.date || o.date > latest.date) ? o : latest
                    , data.orders[0]);
                    const customerNames = [...data.customers].join(' / ');
                    return (
                      <TableRow key={phone}>
                        <TableCell className="font-medium max-w-40 truncate" title={customerNames}>{customerNames}</TableCell>
                        <TableCell dir="ltr" className="text-xs font-mono">{phone}</TableCell>
                        <TableCell>
                          <Badge variant="success" className="text-sm px-2 py-0.5">{data.count}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(data.totalRevenue)}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(data.totalDelivery)}</TableCell>
                        <TableCell className="tabular-nums">{lastOrder.date ? lastOrder.date.toLocaleDateString('ar-DZ') : '-'}</TableCell>
                        <TableCell>{lastOrder.wilaya}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  (paged as TrackingOrder[]).map(t => {
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
                            {deliveredCounts.get(getPhone(t))! >= 2 && (
                              <Badge variant="success" className="text-[10px] px-1 py-0">{deliveredCounts.get(getPhone(t))}</Badge>
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
                  })
                )}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={repeatOnly ? 7 : 10} className="text-center text-[var(--color-text-muted)] py-8">
                      لا توجد بيانات
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
