import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useFilters } from '@/hooks/useFilters';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Download, ArrowUpDown } from 'lucide-react';

const statusOptions: OrderStatus[] = ['Confirmed', 'Failed', 'Pending', 'Waiting'];

export function Orders({ orders }: { orders: Order[] }) {
  const {
    filters, updateFilter, sortKey, sortDir, toggleSort,
    filteredOrders, uniqueStatuses, uniqueWilayas, uniqueAgents,
  } = useFilters(orders);

  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const perPage = 25;

  const pagedOrders = filteredOrders.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filteredOrders.length / perPage);

  const exportCSV = () => {
    const headers = ['رقم الطلب', 'التاريخ', 'العميل', 'الهاتف', 'الولاية', 'الحالة', 'المنتج', 'الإجمالي', 'رسوم الشحن', 'الوكيل'];
    const rows = orders.map(o => [
      o.id, o.date, o.customer, o.phone, o.wilaya, o.status, o.product, o.total, o.delivery, o.agent,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, field }: { label: string; field: keyof Order }) => (
    <TableHead onClick={() => toggleSort(field)} className="cursor-pointer hover:text-[var(--color-text)]">
      <span className="flex items-center gap-1">
        {label}
        {sortKey === field && (
          <ArrowUpDown className={`h-3 w-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
        )}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>جميع الطلبات ({formatNumber(filteredOrders.length)})</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Input
              placeholder="بحث في جميع الحقول..."
              value={filters.search}
              onChange={e => { updateFilter('search', e.target.value); setPage(0); }}
            />
            <Select
              value={filters.statusFilter.join(',')}
              onChange={e => {
                const val = e.target.value;
                updateFilter('statusFilter', val ? val.split(',') as OrderStatus[] : []);
                setPage(0);
              }}
            >
              <option value="">جميع الحالات</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === 'Confirmed' ? 'مؤكد' : s === 'Failed' ? 'فاشل' : s === 'Pending' ? 'قيد الانتظار' : 'بانتظار'}</option>
              ))}
            </Select>
            <Select
              value={filters.wilayaFilter.join(',')}
              onChange={e => { updateFilter('wilayaFilter', e.target.value ? e.target.value.split(',') : []); setPage(0); }}
            >
              <option value="">جميع الولايات</option>
              {uniqueWilayas.map(w => <option key={w} value={w}>{w}</option>)}
            </Select>
            <Select
              value={filters.agentFilter.join(',')}
              onChange={e => { updateFilter('agentFilter', e.target.value ? e.target.value.split(',') : []); setPage(0); }}
            >
              <option value="">جميع الوكلاء</option>
              {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Input
              type="number"
              placeholder="الحد الأدنى"
              value={filters.totalMin ?? ''}
              onChange={e => { updateFilter('totalMin', e.target.value ? Number(e.target.value) : null); setPage(0); }}
            />
            <Input
              type="number"
              placeholder="الحد الأقصى"
              value={filters.totalMax ?? ''}
              onChange={e => { updateFilter('totalMax', e.target.value ? Number(e.target.value) : null); setPage(0); }}
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="رقم الطلب" field="id" />
                  <TableHead>التاريخ</TableHead>
                  <SortHeader label="العميل" field="customer" />
                  <TableHead>الهاتف</TableHead>
                  <SortHeader label="الولاية" field="wilaya" />
                  <SortHeader label="الحالة" field="status" />
                  <SortHeader label="المنتج" field="product" />
                  <SortHeader label="الإجمالي" field="total" />
                  <SortHeader label="رسوم الشحن" field="delivery" />
                  <SortHeader label="الوكيل" field="agent" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedOrders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelectedOrder(o)}>
                    <TableCell className="tabular-nums font-medium">{o.id}</TableCell>
                    <TableCell className="text-xs text-[var(--color-text-muted)]">{o.date}</TableCell>
                    <TableCell>{o.customer}</TableCell>
                    <TableCell dir="ltr" className="text-xs">{o.phone}</TableCell>
                    <TableCell>{o.wilaya}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="max-w-40 truncate">{o.product}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(o.delivery)}</TableCell>
                    <TableCell>{o.agent}</TableCell>
                  </TableRow>
                ))}
                {pagedOrders.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-[var(--color-text-muted)] py-8">لا توجد طلبات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-text-muted)]">
                الصفحة {page + 1} من {totalPages} ({filteredOrders.length} طلب)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>السابق</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>التالي</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="تفاصيل الطلب">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">رقم الطلب</p>
                <p className="font-medium tabular-nums">{selectedOrder.id}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">التاريخ</p>
                <p className="font-medium">{selectedOrder.date}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">العميل</p>
                <p className="font-medium">{selectedOrder.customer}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">الهاتف</p>
                <p className="font-medium" dir="ltr">{selectedOrder.phone}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">الولاية</p>
                <p className="font-medium">{selectedOrder.wilaya}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">الوكيل</p>
                <p className="font-medium">{selectedOrder.agent}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">الحالة</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">المنتج</p>
                <p className="font-medium text-sm">{selectedOrder.product}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">الإجمالي</p>
                <p className="font-medium tabular-nums text-lg">{formatCurrency(selectedOrder.total)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">رسوم الشحن</p>
                <p className="font-medium tabular-nums">{formatCurrency(selectedOrder.delivery)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[var(--color-text-muted)]">صافي الربح (تقديري)</p>
                <p className={`font-bold text-lg tabular-nums ${selectedOrder.total - selectedOrder.delivery - 1400 > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {formatCurrency(selectedOrder.total - selectedOrder.delivery - 1400)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
