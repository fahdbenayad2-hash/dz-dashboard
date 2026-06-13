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

/** normalise a string for fuzzy matching: lowercase + strip diacritics + collapse spaces */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type CustomerGroup = {
  groupId: string;          // canonical key (first phone seen, or "name|wilaya")
  phones: Set<string>;
  names: Set<string>;
  wilayas: Set<string>;
  count: number;
  totalRevenue: number;
  totalDelivery: number;
  orders: TrackingOrder[];
};

/**
 * Build customer groups for delivered orders.
 * Two records belong to the same group if they share:
 *   - the same phone number, OR
 *   - the same normalised (name + wilaya) pair
 *
 * We do a two-pass union:
 *   pass 1 → index by phone and by name|wilaya
 *   pass 2 → merge groups that overlap
 */
function buildCustomerGroups(
  trackingOrders: TrackingOrder[],
  orderPhone: Map<string, string>   // customer name → phone (from Orders sheet)
): Map<string, CustomerGroup> {

  const delivered = trackingOrders.filter(t => t.statusCategory === 'delivered');

  // ── pass 1: assign a tentative groupId to each order ──────────────────────
  // Union-Find parent map (groupId → groupId)
  const parent = new Map<string, string>();
  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }
  function union(a: string, b: string) {
    a = find(a); b = find(b);
    if (a !== b) parent.set(b, a);
  }

  // index: phone → first seen groupId
  const phoneIndex = new Map<string, string>();
  // index: norm(name)|norm(wilaya) → first seen groupId
  const nameWilayaIndex = new Map<string, string>();

  delivered.forEach(t => {
    const phone = orderPhone.get(t.customer) || '';
    const nameKey = norm(t.customer);
    const nwKey = `${nameKey}|${norm(t.wilaya)}`;

    // determine the base key for this record
    const baseKey = phone || nwKey;

    if (phone) {
      if (!phoneIndex.has(phone)) phoneIndex.set(phone, baseKey);
      else union(baseKey, phoneIndex.get(phone)!);
    }

    if (!nameWilayaIndex.has(nwKey)) nameWilayaIndex.set(nwKey, baseKey);
    else union(baseKey, nameWilayaIndex.get(nwKey)!);

    // also union phone and name+wilaya if both exist
    if (phone && nameWilayaIndex.has(nwKey)) {
      union(phoneIndex.get(phone) || baseKey, nameWilayaIndex.get(nwKey)!);
    }
  });

  // ── pass 2: aggregate into groups ─────────────────────────────────────────
  const groups = new Map<string, CustomerGroup>();

  delivered.forEach(t => {
    const phone = orderPhone.get(t.customer) || '';
    const nameKey = norm(t.customer);
    const nwKey = `${nameKey}|${norm(t.wilaya)}`;
    const baseKey = phone || nwKey;
    const gid = find(baseKey);

    let g = groups.get(gid);
    if (!g) {
      g = {
        groupId: gid,
        phones: new Set(),
        names: new Set(),
        wilayas: new Set(),
        count: 0,
        totalRevenue: 0,
        totalDelivery: 0,
        orders: [],
      };
      groups.set(gid, g);
    }
    if (phone) g.phones.add(phone);
    g.names.add(t.customer);
    g.wilayas.add(t.wilaya);
    g.count++;
    g.totalRevenue += t.total;
    g.totalDelivery += t.delivery;
    g.orders.push(t);
  });

  return groups;
}

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

  // ── build smart customer groups ──────────────────────────────────────────
  const allGroups = useMemo(
    () => buildCustomerGroups(trackingOrders, orderPhone),
    [trackingOrders, orderPhone]
  );

  // repeat groups = delivered ≥ 2
  const repeatGroups = useMemo(
    () => [...allGroups.values()].filter(g => g.count >= 2).sort((a, b) => b.count - a.count),
    [allGroups]
  );

  // set of groupIds that are "repeat"
  const repeatGroupIds = useMemo(() => new Set(repeatGroups.map(g => g.groupId)), [repeatGroups]);

  // map: every delivered order's baseKey → its groupId
  const orderGroupId = useMemo(() => {
    const map = new Map<string, string>(); // orderId → groupId
    allGroups.forEach(g => {
      g.orders.forEach(o => map.set(o.orderId, g.groupId));
    });
    return map;
  }, [allGroups]);

  const stats = useMemo(() => getTrackingMetrics(trackingOrders), [trackingOrders]);
  useMemo(() => getTrackingStatusDistribution(trackingOrders), [trackingOrders]);

  // ── filtered list for normal view ────────────────────────────────────────
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
      // show only delivered orders that belong to a repeat group
      list = list.filter(t =>
        t.statusCategory === 'delivered' &&
        repeatGroupIds.has(orderGroupId.get(t.orderId) || '')
      );
      return list.sort((a, b) => {
        const ga = allGroups.get(orderGroupId.get(a.orderId) || '');
        const gb = allGroups.get(orderGroupId.get(b.orderId) || '');
        return (gb?.count || 0) - (ga?.count || 0);
      });
    }
    return list.sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : 0;
      const bTime = b.date ? b.date.getTime() : 0;
      return bTime - aTime;
    });
  }, [trackingOrders, search, categoryFilter, repeatOnly, repeatGroupIds, orderGroupId, allGroups]);

  // ── filtered repeat groups (for summary view) ────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!repeatOnly) return repeatGroups;
    if (!search) return repeatGroups;
    const q = norm(search);
    return repeatGroups.filter(g => {
      if ([...g.phones].some(p => p.includes(q))) return true;
      if ([...g.names].some(n => norm(n).includes(q))) return true;
      if ([...g.wilayas].some(w => norm(w).includes(q))) return true;
      return false;
    });
  }, [repeatGroups, search, repeatOnly]);

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
            <div className="flex items-center gap-2">
              <CardTitle>
                {repeatOnly
                  ? `الزبائن المتكررون (${formatNumber(filteredGroups.length)})`
                  : `سجل التتبع (${formatNumber(filtered.length)})`}
              </CardTitle>
              {repeatOnly && (
                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] px-2 py-0.5 rounded-full">
                  هاتف · اسم+ولاية
                </span>
              )}
            </div>
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
                      <TableHead>الأسماء</TableHead>
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
                    const phones = [...g.phones].join(' / ') || '—';
                    const names = [...g.names].join(' / ');
                    const wilayas = [...g.wilayas].join(' / ');
                    // determine match badge: phone, name+wilaya, or both
                    const hasPhone = g.phones.size > 0;
                    const hasNameWilaya = g.names.size > 1 || g.wilayas.size > 0;
                    return (
                      <TableRow key={g.groupId}>
                        <TableCell className="max-w-48">
                          <div className="font-medium truncate" title={names}>{names}</div>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {hasPhone && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">هاتف</span>
                            )}
                            {hasNameWilaya && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded-full">اسم+ولاية</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell dir="ltr" className="text-xs font-mono whitespace-nowrap">{phones}</TableCell>
                        <TableCell className="text-sm">{wilayas}</TableCell>
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
                    const gid = orderGroupId.get(t.orderId);
                    const isRepeat = gid ? repeatGroupIds.has(gid) : false;
                    const repeatCount = gid ? (allGroups.get(gid)?.count ?? 0) : 0;
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
