import { useMemo, useState } from 'react';
import type { TrackingOrder } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { KPICard } from '@/components/shared/KPICard';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  getYearComparison, getYearlyTopProducts, getYearlyTopWilayas,
} from '@/lib/dashboardMetrics';

function GrowthBadge({ value, unit = '%' }: { value: number; unit?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
      {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value >= 0 ? '+' : ''}{value.toFixed(1)}{unit}
    </span>
  );
}

export function YearlyReport({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trackingOrders.forEach(t => {
      if (t.date instanceof Date && !isNaN(t.date.getTime())) years.add(t.date.getFullYear());
    });
    return [...years].sort().reverse();
  }, [trackingOrders]);

  const [selectedYear, setSelectedYear] = useState<number>(() => availableYears[0] || new Date().getFullYear());

  const comparison = useMemo(() => getYearComparison(trackingOrders, selectedYear), [trackingOrders, selectedYear]);
  const topProducts = useMemo(() => getYearlyTopProducts(trackingOrders, selectedYear), [trackingOrders, selectedYear]);
  const topWilayas = useMemo(() => getYearlyTopWilayas(trackingOrders, selectedYear), [trackingOrders, selectedYear]);

  if (comparison.current.totalOrders === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">تقرير العام</h1>
          <Select value={String(selectedYear)} onChange={e => setSelectedYear(Number(e.target.value))} className="w-32">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <Card>
          <CardContent className="text-center py-12 text-[var(--color-text-muted)]">
            لا توجد بيانات للعام {selectedYear}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">تقرير العام</h1>
        <Select value={String(selectedYear)} onChange={e => setSelectedYear(Number(e.target.value))} className="w-32">
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      {/* Section 1: مقارنة — 4 KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="إجمالي الطلبات" value={formatNumber(comparison.current.totalOrders)}
          subLabel={<GrowthBadge value={comparison.growth.orders} />} />
        <KPICard label="الإيراد (محسوم)" value={formatCurrency(comparison.current.revenue)}
          subLabel={<GrowthBadge value={comparison.growth.revenue} />} color="#1D9E75" />
        <KPICard label="صافي الإيراد" value={formatCurrency(comparison.current.netRevenue)}
          subLabel={<GrowthBadge value={comparison.growth.netRevenue} />} color="#7F77DD" />
        <KPICard label="معدل التوصيل" value={comparison.current.avgDeliveryRate.toFixed(1) + '%'}
          subLabel={<GrowthBadge value={comparison.growth.deliveryRate} unit=" نقطة" />} color="#378ADD" />
      </div>

      {/* Section 2: مقارنة شهر بشهر */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>الطلبات شهرياً — {selectedYear} vs {selectedYear - 1}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={comparison.currentMonths.map(m => m.label)}
                datasets={[
                  { label: String(selectedYear), data: comparison.currentMonths.map(m => m.totalOrders), color: '#378ADD' },
                  { label: String(selectedYear - 1), data: comparison.previousMonths.map(m => m.totalOrders), color: '#7F77DD' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الإيراد شهرياً — {selectedYear} vs {selectedYear - 1}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <LineChart
                labels={comparison.currentMonths.map(m => m.label)}
                datasets={[
                  { label: String(selectedYear), data: comparison.currentMonths.map(m => m.revenue), color: '#1D9E75' },
                  { label: String(selectedYear - 1), data: comparison.previousMonths.map(m => m.revenue), color: '#EF9F27' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: جدول تفصيلي شهر بشهر */}
      <Card>
        <CardHeader><CardTitle>التفصيل الشهري — {selectedYear}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead>إجمالي الطلبات</TableHead>
                  <TableHead>مسلّم</TableHead>
                  <TableHead>مرتجع</TableHead>
                  <TableHead>قيد التنفيذ</TableHead>
                  <TableHead>معدل التوصيل</TableHead>
                  <TableHead>معدل الإرجاع</TableHead>
                  <TableHead>الإيراد</TableHead>
                  <TableHead>صافي الإيراد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.currentMonths.map(m => (
                  <TableRow key={m.month} className={m.totalOrders === 0 ? 'opacity-40' : ''}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(m.totalOrders)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--color-success)]">{formatNumber(m.delivered)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--color-danger)]">{formatNumber(m.returned)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--color-warning)]">{formatNumber(m.inProgress)}</TableCell>
                    <TableCell className={`tabular-nums font-medium ${m.deliveryRate >= 65 ? 'text-[var(--color-success)]' : m.deliveryRate >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'}`}>
                      {m.totalOrders > 0 ? m.deliveryRate.toFixed(1) + '%' : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{m.totalOrders > 0 ? m.cancellationRate.toFixed(1) + '%' : '—'}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(m.revenue)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(m.netRevenue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2 border-[var(--color-border)] bg-[var(--color-primary)]/5">
                  <TableCell>الإجمالي</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(comparison.current.totalOrders)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--color-success)]">{formatNumber(comparison.current.delivered)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--color-danger)]">{formatNumber(comparison.current.returned)}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="tabular-nums">{comparison.current.avgDeliveryRate.toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums">{comparison.current.avgCancellationRate.toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(comparison.current.revenue)}</TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(comparison.current.netRevenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: معدل التوصيل شهرياً */}
      <Card>
        <CardHeader><CardTitle>معدل التوصيل (محسوم) شهرياً — {selectedYear}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <BarChart
              labels={comparison.currentMonths.map(m => m.label)}
              values={comparison.currentMonths.map(m => parseFloat(m.deliveryRate.toFixed(1)))}
              color="#1D9E75"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: أفضل منتجات + أفضل ولايات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>أفضل 15 منتج — {selectedYear}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              <BarChart
                labels={topProducts.map(p => p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name)}
                values={topProducts.map(p => p.revenue)}
                color="#7F77DD"
                horizontal
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>أفضل 20 ولاية — {selectedYear}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              <BarChart
                labels={topWilayas.map(w => w.wilaya)}
                values={topWilayas.map(w => w.orders)}
                color="#378ADD"
                horizontal
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
