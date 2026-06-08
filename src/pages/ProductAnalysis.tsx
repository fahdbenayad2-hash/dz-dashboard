import { useState, useMemo } from 'react';
import type { TrackingOrder, ProductExpenses, ProductPeriodFilter } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { KPICard } from '@/components/shared/KPICard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { analyzeProductPeriod, buildFinancialAnalysis } from '@/lib/financialEngine';
import { TrendingUp, TrendingDown, AlertTriangle, Minus } from 'lucide-react';

function defaultDates() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

export function ProductAnalysis({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const productList = useMemo(() => {
    const map = new Map<string, number>();
    trackingOrders.forEach(t => { if (t.product) map.set(t.product, (map.get(t.product) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [trackingOrders]);

  const defaults = defaultDates();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [dateFrom, setDateFrom]   = useState(defaults.from);
  const [dateTo,   setDateTo]     = useState(defaults.to);
  const [expenses, setExpenses]   = useState<ProductExpenses>({
    adSpend: 0, otherExpenses: 0, expenseNotes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const analysis = useMemo(() => {
    if (!submitted || !selectedProduct) return null;
    const filter: ProductPeriodFilter = { productName: selectedProduct, dateFrom, dateTo };
    const period = analyzeProductPeriod(trackingOrders, filter);
    return buildFinancialAnalysis(period, expenses);
  }, [submitted, selectedProduct, dateFrom, dateTo, expenses, trackingOrders]);

  const handleSubmit = () => {
    if (!selectedProduct || !dateFrom || !dateTo) return;
    setSubmitted(true);
    console.log('[DZ-CHANGE] product-analysis-submit', { selectedProduct, dateFrom, dateTo, expenses });
  };

  const handleExpenseChange = (key: keyof ProductExpenses, value: string | number) => {
    setExpenses(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">تحليل المنتج المتقدم</h1>

      <Card>
        <CardHeader><CardTitle>اختر المنتج والفترة الزمنية</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-2">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">المنتج</label>
              <Select
                value={selectedProduct}
                onChange={e => { setSelectedProduct(e.target.value); setSubmitted(false); }}
                className="w-full"
              >
                <option value="">— اختر منتجاً —</option>
                {productList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">من تاريخ</label>
              <Input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setSubmitted(false); }} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">إلى تاريخ</label>
              <Input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setSubmitted(false); }} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-sm font-semibold mb-3">المصاريف الفعلية خلال الفترة</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                  الإنفاق الإعلاني (دج) — فيسبوك / إنستغرام / ...
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={expenses.adSpend || ''}
                  onChange={e => handleExpenseChange('adSpend', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                  مصاريف أخرى (دج) — تصوير، تصميم، عينات، ...
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={expenses.otherExpenses || ''}
                  onChange={e => handleExpenseChange('otherExpenses', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">ملاحظات</label>
                <Input
                  placeholder="مثال: حملة عيد الفطر..."
                  value={expenses.expenseNotes}
                  onChange={e => handleExpenseChange('expenseNotes', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleSubmit}
              disabled={!selectedProduct || !dateFrom || !dateTo}
              className="w-full md:w-auto"
            >
              تحليل المنتج
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card style={{ borderColor: analysis.decisionColor, borderWidth: 2 }}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">القرار التجاري</p>
                  <p className="text-2xl font-bold" style={{ color: analysis.decisionColor }}>
                    {analysis.decisionLabel}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {selectedProduct} — {dateFrom} إلى {dateTo}
                    {expenses.expenseNotes && ` — ${expenses.expenseNotes}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.decisionReasons.map((r, i) => (
                    <span key={i} className="text-xs rounded-full px-3 py-1 border border-[var(--color-border)] text-[var(--color-text-muted)]">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards — صف 1: أداء الطلبات */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              label="إجمالي الطلبات"
              value={formatNumber(analysis.period.totalOrders)}
              change={0}
              changeLabel={`${analysis.period.daysInPeriod} يوم — متوسط ${analysis.period.avgDailyOrders.toFixed(1)}/يوم`}
            />
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              label="تم التوصيل"
              value={formatNumber(analysis.period.delivered)}
              change={analysis.period.deliveryRate - 100}
              changeLabel={`معدل ${analysis.period.deliveryRate.toFixed(1)}% (محسوم)`}
              color="#1D9E75"
            />
            <KPICard
              icon={<TrendingDown className="h-5 w-5" />}
              label="مرتجع"
              value={formatNumber(analysis.period.returned)}
              change={-analysis.period.cancellationRate}
              changeLabel={`${analysis.period.cancellationRate.toFixed(1)}% من المحسوم`}
              color="#E24B4A"
            />
            <KPICard
              icon={<Minus className="h-5 w-5" />}
              label="قيد التنفيذ"
              value={formatNumber(analysis.period.inProgress)}
              change={0}
              changeLabel="لم يُحسم بعد"
              color="#EF9F27"
            />
          </div>

          {/* KPI Cards — صف 2: الماليات */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              label="إيراد حقيقي (مسلّم)"
              value={formatCurrency(analysis.period.grossRevenue)}
              color="#1D9E75"
            />
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              label="صافي الربح"
              value={formatCurrency(analysis.netProfit)}
              change={analysis.netMargin}
              changeLabel="هامش الربح"
              color={analysis.netProfit >= 0 ? '#1D9E75' : '#E24B4A'}
            />
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              label="ROAS"
              value={analysis.roas > 0 ? analysis.roas.toFixed(2) + 'x' : 'لا يوجد إعلان'}
              change={0}
              changeLabel={analysis.expenses.adSpend > 0 ? `إنفاق ${formatCurrency(analysis.expenses.adSpend)}` : ''}
              color={analysis.roas >= 3 ? '#1D9E75' : analysis.roas >= 2 ? '#EF9F27' : '#E24B4A'}
            />
            <KPICard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="نقطة التعادل"
              value={`${formatNumber(analysis.breakEvenOrders)} طلب`}
              change={0}
              changeLabel={`لتغطية ${formatCurrency(analysis.totalCost)} تكاليف`}
              color="#378ADD"
            />
          </div>

          {/* تفصيل التكاليف + خطة العمل */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>تفصيل التكاليف والإيراد</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'الإيراد الإجمالي (delivered)',      value: analysis.period.grossRevenue,        type: 'income' as const },
                    { label: '← تكلفة شحن المسلّمين',            value: -analysis.period.deliveryCostPaid,   type: 'cost' as const },
                    { label: '← خسارة شحن المرتجعين',            value: -analysis.period.returnShippingLoss, type: 'cost' as const },
                    { label: '← الإنفاق الإعلاني',               value: -analysis.expenses.adSpend,          type: 'cost' as const },
                    { label: '← مصاريف أخرى',                    value: -analysis.expenses.otherExpenses,    type: 'cost' as const },
                    { label: '= صافي الربح',                      value: analysis.netProfit,                  type: 'result' as const },
                  ].map((row, i) => (
                    <div key={i} className={`flex items-center justify-between py-1.5 ${row.type === 'result' ? 'border-t border-[var(--color-border)] pt-2 font-bold' : ''}`}>
                      <span className={row.type === 'cost' ? 'text-[var(--color-text-muted)]' : ''}>{row.label}</span>
                      <span className={`tabular-nums font-medium ${
                        row.type === 'income' ? 'text-[var(--color-success)]' :
                        row.type === 'cost'   ? 'text-[var(--color-danger)]'  :
                        row.value >= 0        ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}>
                        {row.value >= 0 ? '+' : ''}{formatCurrency(Math.abs(row.value))}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                    متوسط قيمة الطلب المسلّم: <span className="font-medium text-[var(--color-text)]">{formatCurrency(analysis.period.avgOrderValue)}</span>
                    {' — '}متوسط تكلفة الشحن: <span className="font-medium text-[var(--color-text)]">{formatCurrency(analysis.period.avgDeliveryCost)}</span>
                    {analysis.cpa > 0 && <> — CPA: <span className="font-medium text-[var(--color-text)]">{formatCurrency(analysis.cpa)}</span></>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ borderRight: `4px solid ${analysis.decisionColor}` }}>
              <CardHeader>
                <CardTitle style={{ color: analysis.decisionColor }}>
                  خطة العمل — {analysis.decisionLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.actionPlan.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                      <span
                        className="flex items-center justify-center h-6 w-6 rounded-full text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: analysis.decisionColor }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm">{action}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* الاتجاه اليومي */}
          {analysis.period.dailyTrend.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>الاتجاه اليومي — {selectedProduct}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <LineChart
                    labels={analysis.period.dailyTrend.map(d => d.date.slice(5))}
                    datasets={[
                      { label: 'الإيراد (مسلّم)', data: analysis.period.dailyTrend.map(d => d.revenue), color: '#1D9E75' },
                      { label: 'إجمالي الطلبات', data: analysis.period.dailyTrend.map(d => d.orders * (analysis.period.avgOrderValue || 1)), color: '#378ADD' },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* أفضل الولايات */}
          {analysis.period.topWilayas.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>أفضل الولايات — {selectedProduct}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <BarChart
                      labels={analysis.period.topWilayas.map(w => w.wilaya)}
                      values={analysis.period.topWilayas.map(w => w.orders)}
                      color="#7F77DD"
                      horizontal
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>معدل التوصيل بالولاية</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-y-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الولاية</TableHead>
                          <TableHead>الطلبات</TableHead>
                          <TableHead>مسلّم</TableHead>
                          <TableHead>معدل التوصيل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.period.topWilayas.map(w => (
                          <TableRow key={w.wilaya}>
                            <TableCell className="font-medium">{w.wilaya}</TableCell>
                            <TableCell className="tabular-nums">{w.orders}</TableCell>
                            <TableCell className="tabular-nums text-[var(--color-success)]">{w.delivered}</TableCell>
                            <TableCell>
                              <span className={`tabular-nums font-medium text-sm ${
                                w.deliveryRate >= 65 ? 'text-[var(--color-success)]' :
                                w.deliveryRate >= 50 ? 'text-[var(--color-warning)]' :
                                'text-[var(--color-danger)]'
                              }`}>
                                {w.deliveryRate.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {!analysis && (
        <Card>
          <CardContent className="py-16 text-center text-[var(--color-text-muted)]">
            اختر منتجاً وحدد الفترة الزمنية ثم اضغط "تحليل المنتج"
          </CardContent>
        </Card>
      )}
    </div>
  );
}
