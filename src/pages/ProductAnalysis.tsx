import { useState, useMemo } from 'react';
import type { TrackingOrder, ProductExpenses, ProductPeriodFilter, WilayaAnalysis, CompetitorData, ProductFinancialAnalysis, ProductPeriodData } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { KPICard } from '@/components/shared/KPICard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { analyzeProductPeriod, buildFinancialAnalysis, buildWilayaAnalysis, buildCompetitiveAnalysis } from '@/lib/financialEngine';
import { TrendingUp, TrendingDown, AlertTriangle, Minus, DollarSign, BarChart3, Target, Shield, ChevronUp, ChevronDown } from 'lucide-react';

function defaultDates() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

type SortKey = 'wilaya' | 'orders' | 'delivered' | 'deliveryRate' | 'revenue' | 'avgOrderValue' | 'score' | 'tier';
type SortDir = 'asc' | 'desc';

function ProductAnalysisView({
  productName, period, analysis, wilayaAnalysis, competitive, showCompetitor, competitorData, setCompetitorData,
  dateFrom, dateTo, expenses,
}: {
  productName: string;
  period: ProductPeriodData;
  analysis: ProductFinancialAnalysis;
  wilayaAnalysis: WilayaAnalysis[];
  competitive: ReturnType<typeof buildCompetitiveAnalysis> | null;
  showCompetitor: boolean;
  competitorData: CompetitorData;
  setCompetitorData: (d: CompetitorData) => void;
  dateFrom: string;
  dateTo: string;
  expenses: ProductExpenses;
}) {
  const [wilayaSort, setWilayaSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'score', dir: 'desc' });

  const toggleWilayaSort = (key: SortKey) => {
    setWilayaSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  };

  const sortedWilayas = useMemo(() => {
    const sorted = [...wilayaAnalysis];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (wilayaSort.key) {
        case 'wilaya': cmp = a.wilaya.localeCompare(b.wilaya); break;
        case 'orders': cmp = a.orders - b.orders; break;
        case 'delivered': cmp = a.delivered - b.delivered; break;
        case 'deliveryRate': cmp = a.deliveryRate - b.deliveryRate; break;
        case 'revenue': cmp = a.revenue - b.revenue; break;
        case 'avgOrderValue': cmp = a.avgOrderValue - b.avgOrderValue; break;
        case 'score': cmp = a.score - b.score; break;
        case 'tier': cmp = a.tier.localeCompare(b.tier); break;
      }
      return wilayaSort.dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [wilayaAnalysis, wilayaSort]);

  const tierColor = (tier: string) => {
    switch (tier) {
      case 'A': return 'var(--color-success)';
      case 'B': return 'var(--color-primary)';
      case 'C': return 'var(--color-warning)';
      case 'D': return 'var(--color-danger)';
      default: return 'var(--color-text-muted)';
    }
  };

  const scoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 45) return 'bg-blue-100 dark:bg-blue-900/30';
    if (score >= 25) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="space-y-6">
      {/* Decision Banner */}
      <Card style={{ borderColor: analysis.decisionColor, borderWidth: 2 }}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">القرار التجاري</p>
              <p className="text-2xl font-bold" style={{ color: analysis.decisionColor }}>
                {analysis.decisionLabel}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {productName} — {dateFrom} إلى {dateTo}
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
          value={formatNumber(period.totalOrders)}
          change={0}
          changeLabel={`${period.daysInPeriod} يوم — متوسط ${period.avgDailyOrders.toFixed(1)}/يوم`}
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          label="تم التوصيل"
          value={formatNumber(period.delivered)}
          change={period.deliveryRate - 100}
          changeLabel={`معدل ${period.deliveryRate.toFixed(1)}% (محسوم)`}
          color="var(--color-success)"
        />
        <KPICard
          icon={<TrendingDown className="h-5 w-5" />}
          label="مرتجع"
          value={formatNumber(period.returned)}
          change={-period.cancellationRate}
          changeLabel={`${period.cancellationRate.toFixed(1)}% من المحسوم`}
          color="var(--color-danger)"
        />
        <KPICard
          icon={<Minus className="h-5 w-5" />}
          label="قيد التنفيذ"
          value={formatNumber(period.inProgress)}
          change={0}
          changeLabel="لم يُحسم بعد"
          color="var(--color-warning)"
        />
      </div>

      {/* KPI Cards — صف 2: الماليات الموسعة */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          label="صافي الربح الحقيقي"
          value={formatCurrency(analysis.trueNetProfit)}
          change={analysis.trueNetMargin}
          changeLabel="الهامش الحقيقي"
          color={analysis.trueNetProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
        <KPICard
          icon={<BarChart3 className="h-5 w-5" />}
          label="ربح القطعة"
          value={formatCurrency(analysis.profitPerUnit)}
          change={0}
          changeLabel={`بعد خصم ${formatCurrency(analysis.variableCostPerOrder)} متغيرات/قطعة`}
          color={analysis.profitPerUnit > 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
        <KPICard
          icon={<Target className="h-5 w-5" />}
          label="ROI"
          value={analysis.roi.toFixed(1) + '%'}
          change={0}
          changeLabel={`على استثمار ${formatCurrency(analysis.totalInvestment)}`}
          color={analysis.roi > 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
        <KPICard
          icon={<Shield className="h-5 w-5" />}
          label="نقطة التعادل (وحدات)"
          value={formatNumber(analysis.breakEvenUnits)}
          change={0}
          changeLabel={`لتغطية التكاليف الثابتة ${formatCurrency(analysis.expenses.adSpend + analysis.expenses.otherExpenses)}`}
          color="var(--color-primary)"
        />
      </div>

      {/* Full P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>قائمة الدخل الكاملة (P&L)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { label: 'الإيراد الإجمالي (مسلّم)', value: period.grossRevenue, type: 'income' as const },
                { label: '← الإيراد الصافي (بعد الشحن)', value: period.netRevenue, type: 'income' as const },
                { label: '', value: 0, type: 'separator' as const },
                { label: 'تكلفة البضاعة المباعة (COGS)', value: -analysis.totalCOGS, type: 'cost' as const },
                { label: 'رسوم الشحن (للطلبات المسلّمة)', value: -analysis.totalShippingPaid, type: 'cost' as const },
                { label: 'رسوم التغليف', value: -analysis.totalPackaging, type: 'cost' as const },
                { label: 'تكلفة المرتجعات (وحدة + رسوم)', value: -analysis.returnTotalCost, type: 'cost' as const },
                { label: 'تكلفة شحن المسلّمين', value: -period.deliveryCostPaid, type: 'cost' as const },
                { label: 'خسارة شحن المرتجعين', value: -period.returnShippingLoss, type: 'cost' as const },
                { label: 'الإنفاق الإعلاني', value: -analysis.expenses.adSpend, type: 'cost' as const },
                { label: 'مصاريف أخرى', value: -analysis.expenses.otherExpenses, type: 'cost' as const },
                { label: '', value: 0, type: 'separator' as const },
                { label: '= صافي الربح الحقيقي', value: analysis.trueNetProfit, type: 'result' as const },
                { label: 'الهامش الحقيقي', value: analysis.trueNetMargin, type: 'resultPercent' as const },
              ].map((row, i) => (
                row.type === 'separator'
                  ? <div key={i} className="border-t border-[var(--color-border)]" />
                  : (
                    <div key={i} className={`flex items-center justify-between py-1 ${row.type === 'result' || row.type === 'resultPercent' ? 'border-t border-[var(--color-border)] pt-2 font-bold' : ''}`}>
                      <span className={row.type === 'cost' ? 'text-[var(--color-text-muted)]' : ''}>{row.label}</span>
                      <span className={`tabular-nums font-medium ${
                        row.type === 'income' ? 'text-[var(--color-success)]' :
                        row.type === 'cost' ? 'text-[var(--color-danger)]' :
                        row.type === 'resultPercent' ? (
                          row.value >= 20 ? 'text-[var(--color-success)]' :
                          row.value >= 8 ? 'text-[var(--color-warning)]' :
                          'text-[var(--color-danger)]'
                        ) :
                        row.value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}>
                        {row.type === 'resultPercent' ? `${row.value.toFixed(1)}%` : `${row.value >= 0 ? '+' : ''}${formatCurrency(Math.abs(row.value))}`}
                      </span>
                    </div>
                  )
              ))}
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                متوسط قيمة الطلب: <span className="font-medium text-[var(--color-text)]">{formatCurrency(period.avgOrderValue)}</span>
                {' — '}متوسط الشحن: <span className="font-medium text-[var(--color-text)]">{formatCurrency(period.avgDeliveryCost)}</span>
                {analysis.cpa > 0 && <> — CPA: <span className="font-medium text-[var(--color-text)]">{formatCurrency(analysis.cpa)}</span></>}
                {' — '}ROAS: <span className="font-medium text-[var(--color-text)]">{analysis.roas.toFixed(2)}x</span>
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
      {period.dailyTrend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>الاتجاه اليومي — {productName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <LineChart
                labels={period.dailyTrend.map(d => d.date.slice(5))}
                datasets={[
                  { label: 'الإيراد (مسلّم)', data: period.dailyTrend.map(d => d.revenue), color: '#1D9E75' },
                  { label: 'إجمالي الطلبات', data: period.dailyTrend.map(d => d.orders * (period.avgOrderValue || 1)), color: '#378ADD' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wilaya Deep Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>تحليل عميق للولايات — {productName}</CardTitle>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {wilayaAnalysis.length} ولاية | التصنيف: A (أفضل) → D (أسوأ) | الترتيب الافتراضي حسب النتيجة
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    { key: 'wilaya' as SortKey, label: 'الولاية' },
                    { key: 'orders' as SortKey, label: 'الطلبات' },
                    { key: 'delivered' as SortKey, label: 'مسلّم' },
                    { key: 'deliveryRate' as SortKey, label: 'معدل التوصيل' },
                    { key: 'revenue' as SortKey, label: 'الإيراد' },
                    { key: 'avgOrderValue' as SortKey, label: 'متوسط الطلب' },
                    { key: 'score' as SortKey, label: 'النتيجة' },
                    { key: 'tier' as SortKey, label: 'التصنيف' },
                  ].map(col => (
                    <TableHead key={col.key} className="cursor-pointer select-none" onClick={() => toggleWilayaSort(col.key)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {wilayaSort.key === col.key && (
                          wilayaSort.dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                        )}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWilayas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[var(--color-text-muted)] py-8">
                      لا توجد بيانات
                    </TableCell>
                  </TableRow>
                )}
                {sortedWilayas.map(w => (
                  <TableRow key={w.wilaya}>
                    <TableCell className="font-medium">{w.wilaya}</TableCell>
                    <TableCell className="tabular-nums text-center">{w.orders}</TableCell>
                    <TableCell className="tabular-nums text-center">{w.delivered}</TableCell>
                    <TableCell>
                      <span className={`tabular-nums font-medium text-sm ${
                        w.deliveryRate >= 65 ? 'text-[var(--color-success)]' :
                        w.deliveryRate >= 50 ? 'text-[var(--color-warning)]' :
                        'text-[var(--color-danger)]'
                      }`}>
                        {w.deliveryRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(w.revenue)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(w.avgOrderValue)}</TableCell>
                    <TableCell>
                      <span className={`tabular-nums font-medium inline-block px-2 py-0.5 rounded ${scoreBg(w.score)}`}
                        style={{ color: tierColor(w.tier) }}>
                        {w.score.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums font-bold text-lg" style={{ color: tierColor(w.tier) }}>
                        {w.tier}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Score legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-success)' }} /> A (≥70) — تصعيد</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-primary)' }} /> B (45-69) — تحسين</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-warning)' }} /> C (25-44) — حذر</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-danger)' }} /> D (&lt;25) — خطر</span>
            <span>الدرجة = معدل التوصيل×40% + حصة الربح×35% + حصة الطلبات×25%</span>
          </div>
        </CardContent>
      </Card>

      {/* Wilaya Bar Charts */}
      {wilayaAnalysis.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>حجم الطلبات بالولاية</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <BarChart
                  labels={wilayaAnalysis.slice(0, 10).map(w => w.wilaya)}
                  values={wilayaAnalysis.slice(0, 10).map(w => w.orders)}
                  color="#7F77DD"
                  horizontal
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>معدل التوصيل — أعلى 10 ولايات</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <BarChart
                  labels={[...wilayaAnalysis].sort((a, b) => b.deliveryRate - a.deliveryRate).slice(0, 10).map(w => w.wilaya)}
                  values={[...wilayaAnalysis].sort((a, b) => b.deliveryRate - a.deliveryRate).slice(0, 10).map(w => w.deliveryRate)}
                  color="#1D9E75"
                  horizontal
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Competitive Analysis */}
      {showCompetitor && (
        <Card>
          <CardHeader>
            <CardTitle>التحليل التنافسي — {productName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">سعر المنافس (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={competitorData.competitorPrice || ''}
                  onChange={e => setCompetitorData({ ...competitorData, competitorPrice: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">معدل توصيل السوق (%)</label>
                <Input type="number" min={0} max={100} placeholder="70"
                  value={competitorData.marketAvgDeliveryRate}
                  onChange={e => setCompetitorData({ ...competitorData, marketAvgDeliveryRate: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">متوسط CPA السوق (دج)</label>
                <Input type="number" min={0} placeholder="500"
                  value={competitorData.marketAvgCPA}
                  onChange={e => setCompetitorData({ ...competitorData, marketAvgCPA: Number(e.target.value) })} />
              </div>
            </div>

            {competitive && (
              <>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 p-4 rounded-lg border" style={{ borderColor: competitive.positionColor }}>
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">الوضع التنافسي</p>
                    <p className="text-2xl font-bold" style={{ color: competitive.positionColor }}>
                      {competitive.positionLabel}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      النتيجة التنافسية: {competitive.competitiveScore}/100
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs rounded-full px-3 py-1 border border-[var(--color-border)]">
                      فرق السعر: {competitive.priceGap >= 0 ? '+' : ''}{competitive.priceGap.toFixed(1)}%
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 border border-[var(--color-border)]">
                      التوصيل: {competitive.deliveryAdvantage >= 0 ? '+' : ''}{competitive.deliveryAdvantage.toFixed(1)}%
                    </span>
                    <span className="text-xs rounded-full px-3 py-1 border border-[var(--color-border)]">
                      CPA: {competitive.cpaEfficiency >= 0 ? '+' : ''}{competitive.cpaEfficiency.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-semibold mb-2 text-[var(--color-success)]">المزايا التنافسية</p>
                    {competitive.advantages.length === 0 && (
                      <p className="text-xs text-[var(--color-text-muted)]">لا توجد مزايا واضحة</p>
                    )}
                    {competitive.advantages.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2 text-sm">
                        <span className="text-[var(--color-success)] mt-0.5">✓</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2 text-[var(--color-danger)]">مواطن الضعف</p>
                    {competitive.weaknesses.length === 0 && (
                      <p className="text-xs text-[var(--color-text-muted)]">لا توجد نقاط ضعف واضحة</p>
                    )}
                    {competitive.weaknesses.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2 text-sm">
                        <span className="text-[var(--color-danger)] mt-0.5">✗</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-sm font-semibold mb-2">التوصيات التنافسية</p>
                  <div className="space-y-2">
                    {competitive.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-[var(--color-primary)] mt-0.5">{i + 1}.</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProductAnalysis({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const productList = useMemo(() => {
    const map = new Map<string, number>();
    trackingOrders.forEach(t => { if (t.product) map.set(t.product, (map.get(t.product) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [trackingOrders]);

  const defaults = defaultDates();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [dateFrom, setDateFrom]   = useState(defaults.from);
  const [dateTo,   setDateTo]     = useState(defaults.to);
  const [expenses, setExpenses]   = useState<ProductExpenses>({
    adSpend: 0, otherExpenses: 0, expenseNotes: '',
    unitCost: 0, shippingFeePerOrder: 0, returnFeePerOrder: 0, packagingCostPerOrder: 0,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showCompetitor, setShowCompetitor] = useState(false);
  const [competitorData, setCompetitorData] = useState<CompetitorData>({
    competitorPrice: 0, marketAvgDeliveryRate: 70, marketAvgCPA: 500,
  });

  const productAnalyses = useMemo(() => {
    if (selectedProducts.length === 0 || !submitted) return [];
    return selectedProducts.map(productName => {
      const filter: ProductPeriodFilter = { productName, dateFrom, dateTo };
      const period = analyzeProductPeriod(trackingOrders, filter);
      const analysis = buildFinancialAnalysis(period, expenses);
      const wilaya = buildWilayaAnalysis(trackingOrders, filter, expenses);
      const competitive = showCompetitor ? buildCompetitiveAnalysis(analysis, competitorData) : null;
      return { productName, period, analysis, wilaya, competitive };
    });
  }, [selectedProducts, dateFrom, dateTo, expenses, showCompetitor, competitorData, submitted, trackingOrders]);

  const handleToggleProduct = (product: string) => {
    setSelectedProducts(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    );
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (selectedProducts.length === 0 || !dateFrom || !dateTo) return;
    setSubmitted(true);
    console.log('[DZ-CHANGE] product-analysis-submit', { selectedProducts, dateFrom, dateTo, expenses });
  };

  const handleExpenseChange = (key: keyof ProductExpenses, value: string | number) => {
    setExpenses(prev => ({ ...prev, [key]: value }));
    if (key !== 'expenseNotes') setSubmitted(false);
  };

  const comparisonRows = useMemo(() => {
    if (productAnalyses.length < 2) return [];
    return [
      { label: 'إجمالي الطلبات', values: productAnalyses.map(pa => formatNumber(pa.period.totalOrders)) },
      { label: 'تم التوصيل', values: productAnalyses.map(pa => formatNumber(pa.period.delivered)) },
      { label: 'معدل التوصيل', values: productAnalyses.map(pa => pa.period.deliveryRate.toFixed(1) + '%') },
      { label: 'المرتجعات', values: productAnalyses.map(pa => formatNumber(pa.period.returned)) },
      { label: 'الإيراد (مسلّم)', values: productAnalyses.map(pa => formatCurrency(pa.period.grossRevenue)) },
      { label: 'صافي الربح', values: productAnalyses.map(pa => formatCurrency(pa.analysis.trueNetProfit)) },
      { label: 'الهامش الحقيقي', values: productAnalyses.map(pa => pa.analysis.trueNetMargin.toFixed(1) + '%') },
      { label: 'ROI', values: productAnalyses.map(pa => pa.analysis.roi.toFixed(1) + '%') },
      { label: 'ربح القطعة', values: productAnalyses.map(pa => formatCurrency(pa.analysis.profitPerUnit)) },
      { label: 'نقطة التعادل', values: productAnalyses.map(pa => formatNumber(pa.analysis.breakEvenUnits)) },
      { label: 'القرار', values: productAnalyses.map(pa => pa.analysis.decisionLabel) },
    ];
  }, [productAnalyses]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">تحليل المنتج المتقدم</h1>

      <Card>
        <CardHeader>
          <CardTitle>اختر المنتجات والفترة الزمنية</CardTitle>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            اختر منتجاً واحداً للتحليل الفردي، أو منتجين للمقارنة جنباً إلى جنب
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block text-xs text-[var(--color-text-muted)] mb-2">المنتجات</label>
            {productList.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">لا توجد منتجات متاحة</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--color-border)] rounded-lg">
              {productList.map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer text-sm p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input type="checkbox" checked={selectedProducts.includes(p)}
                    onChange={() => handleToggleProduct(p)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span className="truncate">{p}</span>
                </label>
              ))}
            </div>
            {selectedProducts.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                تم اختيار {selectedProducts.length} منتج{selectedProducts.length >= 2 ? ' — سيتم عرض مقارنة' : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">الإنفاق الإعلاني (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.adSpend || ''}
                  onChange={e => handleExpenseChange('adSpend', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">مصاريف أخرى (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.otherExpenses || ''}
                  onChange={e => handleExpenseChange('otherExpenses', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">تكلفة الوحدة (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.unitCost || ''}
                  onChange={e => handleExpenseChange('unitCost', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">رسوم شحن/طلب (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.shippingFeePerOrder || ''}
                  onChange={e => handleExpenseChange('shippingFeePerOrder', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">رسوم إرجاع (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.returnFeePerOrder || ''}
                  onChange={e => handleExpenseChange('returnFeePerOrder', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">تغليف/طلب (دج)</label>
                <Input type="number" min={0} placeholder="0"
                  value={expenses.packagingCostPerOrder || ''}
                  onChange={e => handleExpenseChange('packagingCostPerOrder', Number(e.target.value))} />
              </div>
              <div className="md:col-span-3 xl:col-span-6">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">ملاحظات</label>
                <Input placeholder="مثال: حملة عيد الفطر..."
                  value={expenses.expenseNotes}
                  onChange={e => handleExpenseChange('expenseNotes', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleSubmit} disabled={selectedProducts.length === 0 || !dateFrom || !dateTo} className="w-full md:w-auto">
              تحليل {selectedProducts.length >= 2 ? 'المقارنة' : 'المنتج'}
            </Button>
            <Button variant="outline" onClick={() => setShowCompetitor(p => !p)} className="w-full md:w-auto">
              {showCompetitor ? 'إخفاء' : 'إظهار'} التحليل التنافسي
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {productAnalyses.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>مقارنة المنتجات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">المعيار</TableHead>
                    {productAnalyses.map(pa => (
                      <TableHead key={pa.productName} className="whitespace-nowrap text-center font-bold">
                        {pa.productName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map(row => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium whitespace-nowrap">{row.label}</TableCell>
                      {row.values.map((val, i) => (
                        <TableCell key={i} className="text-center tabular-nums">{val}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Product Analyses */}
      {productAnalyses.map((pa, index) => (
        <div key={pa.productName}>
          {productAnalyses.length >= 2 && (
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: index === 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>
                {index + 1}
              </div>
              <h2 className="text-lg font-bold">{pa.productName}</h2>
            </div>
          )}
          <ProductAnalysisView
            productName={pa.productName}
            period={pa.period}
            analysis={pa.analysis}
            wilayaAnalysis={pa.wilaya}
            competitive={pa.competitive}
            showCompetitor={showCompetitor}
            competitorData={competitorData}
            setCompetitorData={setCompetitorData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            expenses={expenses}
          />
        </div>
      ))}

      {productAnalyses.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-[var(--color-text-muted)]">
            اختر منتجاً أو أكثر وحدد الفترة الزمنية ثم اضغط "تحليل المقارنة"
          </CardContent>
        </Card>
      )}
    </div>
  );
}
