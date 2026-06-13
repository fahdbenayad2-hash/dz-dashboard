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

/** Normalise a string: lowercase + strip diacritics + collapse spaces */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Composite key = phone + normalised(name) + normalised(wilaya)
 * All three must match for two records to be considered the same customer.
 * If phone is missing, the record is excluded from repeat detection.
 */
function customerKey(phone: string, name: string, wilaya: string): string | null {
  const p = phone.trim();
  if (!p) return null; // no phone → can't reliably identify
  return `${p}__${norm(name)}__${norm(wilaya)}`;
}

type CustomerGroup = {
  key: string;
  phone: string;
  names: Set<string>;
  wilaya: string;
  count: number;
  totalRevenue: number;
  totalDelivery: number;
  orders: TrackingOrder[];
};

export function Tracking({ orders = [], trackingOrders }: { orders?: Order[]; trackingOrders: TrackingOrder[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;

  // phone lookup from orders sheet (customer name → phone)
  const orderPhone = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => map.set(o.customer, o.phone));
    return map;
  }, [orders]);

  function getPhone(t: TrackingOrder): string {
    return orderPhone.get(t.customer) || '';
  }

  // ── build customer groups for delivered orders ──────────────────────────
  // Key = phone + name + wilaya (all three must match)
  const allGroups = useMemo(() => {
    const map = new Map<string, CustomerGroup>();
    trackingOrders
      .filter(t => t.statusCategory === 'delivered')
      .forEach(t => {
        const phone = getPhone(t);
        const key = customerKey(phone, t.customer, t.wilaya);
        if (!key) return; // skip if no phone

        let g = map.get(key);
        if (!g) {
          g = {
            key,
            phone,
            names: new Set(),
            wilaya: t.wilaya,
            count: 0,
            totalRevenue: 0,
            totalDelivery: 0,
            orders: [],
          };
          map.set(key, g);
        }
        g.names.add(t.customer);
        g.count++;
        g.totalRevenue += t.total;
        g.totalDelivery += t.delivery;
        g.orders.push(t);
      });
    return map;
  }, [trackingOrders, orderPhone]);

  // repeat = delivered ≥ 2, sorted by count desc
  const repeatGroups = useMemo(
    () => [...allGroups.values()].filter(g => g.count >= 2).sort((a, b) => b.count - a.count),
    [allGroups]
  );

  const repeatKeys = useMemo(() => new Set(repeatGroups.map(g => g.key)), [repeatGroups]);

  // orderId → group key (for badge in normal view)
  const orderKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    allGroups.forEach(g => g.orders.forEach(o => map.set(o.orderId, g.key)));
    return map;
  }, [allGroups]);

  const stats = useMemo(() => getTrackingMetrics(trackingOrders), [trackingOrders]);
  useMemo(() => getTrackingStatusDistribution(trackingOrders), [trackingOrders]);

  // ── filtered list (normal view) ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...trackingOrders];
    if (search) {
      const q = norm(search);
      list = list.filter(t =>
        norm(t.customer).includes(q) ||
        getPhone(t).includes(q) ||
        norm(t.wilaya).includes(q) ||
        norm(t.product).includes(q) ||
        t.orderId.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.statusCategory === categoryFilter);
    }
    if (repeatOnly) {
      list = list.filter(t => {
        const key = orderKeyMap.get(t.orderId);
        return key ? repeatKeys.has(key) : false;
      });
      return list.sort((a, b) => {
        const ca = allGroups.get(orderKeyMap.get(a.orderId) || '')?.count ?? 0;
        const cb = allGroups.get(orderKeyMap.get(b.orderId) || '')?.count ?? 0;
        return cb - ca;
      });
    }
    return list.sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : 0;
      const bTime = b.date ? b.date.getTime() : 0;
      return bTime - aTime;
    });
  }, [trackingOrders, search, categoryFilter, repeatOnly, repeatKeys, orderKeyMap, allGroups]);

  // ── filtered repeat groups (summary view) ───────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!search) return repeatGroups;
    const q = norm(search);
    return repeatGroups.filter(g =>
      g.phone.includes(q) ||
      [...g.names].some(n => norm(n).includes(q)) ||
      norm(g.wilaya).includes(q)
    );
  }, [repeatGroups, search]);

  const paged = repeatOnly
    ? filteredGroups.slice(page * perPage, (page + 1) * perPage)
    : filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil((repeatOnly ? filteredGroups.length : filtered.length) / perPage);

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
            <CardTitle>
              {repeatOnly
                ? `الزبائن المتكررون (${formatNumber(filteredGroups.length)})`
                : `سجل التتبع (${formatNumber(filtered.length)})`}
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant={repeatOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setRepeatOnly(v => !v); setPage(0); }}
                className="gap-1.5"
              >
                <Repeat className="h-4 w-4" />
                {repeatOnly ? 'متكرر (تم التوصيل)' : `متكرر (${repeatGroups.length})`}
              </Button>
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="w-48"
              />
              {!repeatOnly && (
                <Select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}>
                  <option value="all">جميع الحالات</option>
                  <option value="delivered">تم التوصيل</option>
                  <option value="returned">مرتجع</option>
                  <option value="transit">قيد التوصيل</option>
                  <option value="delivery">جاري التوزيع</option>
                  <option value="others">أخرى</option>
                </Select>
              )}
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
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الولاية</TableHead>
                      <TableHead>عدد الطلبيات</TableHead>
                      <TableHead>إجمالي الإيراد</TableHead>
                      <TableHead>إجمالي الشحن</TableHead>
                      <TableHead>آخر طلب</TableHead>
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
                  (paged as CustomerGroup[]).map(g => {
                    const lastOrder = g.orders.reduce((latest, o) =>
                      o.date && (!latest.date || o.date > latest.date) ? o : latest,
                      g.orders[0]
                    );
                    const displayName = [...g.names].join(' / ');
                    return (
                      <TableRow key={g.key}>
                        <TableCell className="font-medium max-w-48 truncate" title={displayName}>
                          {displayName}
                        </TableCell>
                        <TableCell dir="ltr" className="text-xs font-mono">{g.phone}</TableCell>
                        <TableCell>{g.wilaya}</TableCell>
                        <TableCell>
                          <Badge variant="success" className="text-sm px-2 py-0.5">{g.count}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(g.totalRevenue)}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(g.totalDelivery)}</TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {lastOrder.date ? lastOrder.date.toLocaleDateString('ar-DZ') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  (paged as TrackingOrder[]).map(t => {
                    const cfg = categoryConfig[t.statusCategory] || categoryConfig.others;
                    const Icon = cfg.icon;
                    const key = orderKeyMap.get(t.orderId);
                    const isRepeat = key ? repeatKeys.has(key) : false;
                    const repeatCount = key ? (allGroups.get(key)?.count ?? 0) : 0;
                    return (
                      <TableRow key={t.orderId}>
                        <TableCell className="font-medium tabular-nums">{t.orderId}</TableCell>
                        <TableCell className="tabular-nums">{t.date ? t.date.toLocaleDateString('ar-DZ') : '-'}</TableCell>
                        <TableCell>{t.agent}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {t.customer}
                            {isRepeat && repeatCount >= 2 && (
                              <Badge variant="success" className="text-[10px] px-1 py-0">{repeatCount}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{t.wilaya}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>
                            <Icon className="h-3 w-3 ml-1" />
                            {cfg.label}
                          </Badge>
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
