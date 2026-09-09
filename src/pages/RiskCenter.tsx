import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Search, ShieldCheck, Siren } from 'lucide-react';
import type { TrackingOrder, PricingInputs, PricingResult } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RiskMeter } from '@/components/shared/RiskMeter';
import { calculatePricing } from '@/lib/financialEngine';
import { getRiskDetail } from '@/lib/riskScore';
import { formatNumber } from '@/lib/utils';

interface ProductAggregate {
  name: string;
  total: number;
  delivered: number;
  returned: number;
  totalValue: number;
}

interface ProductRisk {
  name: string;
  sampleSize: number;
  inputs: PricingInputs;
  result: PricingResult;
}

const PAGE_SIZE = 25;

function aggregateProducts(tracking: TrackingOrder[]): ProductAggregate[] {
  const products = new Map<string, ProductAggregate>();
  for (const order of tracking) {
    if (!order.product) continue;
    const current = products.get(order.product) ?? { name: order.product, total: 0, delivered: 0, returned: 0, totalValue: 0 };
    current.total += 1;
    current.totalValue += order.total;
    if (order.statusCategory === 'delivered') current.delivered += 1;
    if (order.statusCategory === 'returned') current.returned += 1;
    products.set(order.product, current);
  }
  return [...products.values()];
}

function makePricingInputs(product: ProductAggregate): PricingInputs {
  const settled = product.delivered + product.returned;
  const cancelRate = settled > 0 ? (product.returned / settled) * 100 : 37;
  const avgTotal = product.total > 0 ? product.totalValue / product.total : 2000;
  return {
    fabricPricePerMeter: 450, fabricMeters: 2.5, sewingCost: 400, accessoriesCost: 50,
    storageCost: 58, packagingCost: 50, shippingFee: 300, returnCost: 300,
    codType: 'percentage', codValue: 3.5, adCostPerOrder: Math.max(200, avgTotal * 0.25),
    cancellationRate: Math.min(cancelRate, 80), desiredProfit: 500,
  };
}

export function RiskCenter({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(0);

  const productRiskData = useMemo<ProductRisk[]>(() => aggregateProducts(trackingOrders)
    .map(product => {
      const inputs = makePricingInputs(product);
      return { name: product.name, sampleSize: product.total, inputs, result: calculatePricing(inputs) };
    })
    .sort((a, b) => a.result.riskScore - b.result.riskScore), [trackingOrders]);

  const portfolio = useMemo(() => {
    if (productRiskData.length === 0) return null;
    const distribution = { low: 0, medium: 0, high: 0 };
    let scoreTotal = 0;
    const urgentFixes: { product: string; action: string; score: number }[] = [];
    for (const product of productRiskData) {
      scoreTotal += product.result.riskScore;
      if (product.result.riskScore >= 80) distribution.low += 1;
      else if (product.result.riskScore >= 50) distribution.medium += 1;
      else distribution.high += 1;
      if (product.result.riskScore < 50) urgentFixes.push({
        product: product.name,
        action: product.inputs.cancellationRate > 40 ? 'خفض معدل الإرجاع' : 'تحسين هامش الربح',
        score: product.result.riskScore,
      });
    }
    return { score: Math.round(scoreTotal / productRiskData.length), distribution, urgentFixes: urgentFixes.slice(0, 3) };
  }, [productRiskData]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return productRiskData.filter(product => {
      const matchesSearch = !query || product.name.toLocaleLowerCase().includes(query);
      const level = product.result.riskScore >= 80 ? 'low' : product.result.riskScore >= 50 ? 'medium' : 'high';
      return matchesSearch && (riskFilter === 'all' || level === riskFilter);
    });
  }, [productRiskData, riskFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleProducts = filteredProducts.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedRisk = useMemo(() => {
    if (!selectedProduct) return null;
    const product = productRiskData.find(item => item.name === selectedProduct);
    return product ? { product, detail: getRiskDetail(product.inputs, product.result) } : null;
  }, [selectedProduct, productRiskData]);

  const selectProduct = (name: string) => {
    setSelectedProduct(name);
    requestAnimationFrame(() => document.getElementById('risk-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="space-y-5">
      {portfolio && <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="صحة المحفظة" value={`${portfolio.score}/100`} tone={portfolio.score >= 80 ? 'success' : portfolio.score >= 50 ? 'warning' : 'danger'} />
          <SummaryCard icon={<Siren className="h-5 w-5" />} label="مخاطر مرتفعة" value={formatNumber(portfolio.distribution.high)} tone="danger" />
          <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="مخاطر متوسطة" value={formatNumber(portfolio.distribution.medium)} tone="warning" />
          <SummaryCard icon={<Boxes className="h-5 w-5" />} label="المنتجات المحللة" value={formatNumber(productRiskData.length)} tone="primary" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <Card>
            <CardHeader className="border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3">
                <div><CardTitle>إجراءات مطلوبة</CardTitle><p className="mt-1 text-xs text-[var(--color-text-muted)]">المنتجات ذات الأثر الأعلى التي تحتاج مراجعة</p></div>
                <Badge variant={portfolio.urgentFixes.length ? 'danger' : 'success'}>{portfolio.urgentFixes.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--color-border)] p-0">
              {portfolio.urgentFixes.map((fix, index) => <button key={`${fix.product}-${index}`} onClick={() => selectProduct(fix.product)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-right transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] dark:hover:bg-gray-800/50">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{fix.product}</span><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{fix.action}</span></span>
                <span className="shrink-0 text-sm font-bold text-[var(--color-danger)] tabular-nums">{fix.score}/100</span>
              </button>)}
              {portfolio.urgentFixes.length === 0 && <p className="p-6 text-center text-sm text-[var(--color-text-muted)]">لا توجد إجراءات عاجلة حالياً</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>توزيع المخاطر</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RiskMeter score={portfolio.score} level={portfolio.score >= 80 ? 'منخفض' : portfolio.score >= 50 ? 'متوسط' : 'مرتفع'} color={portfolio.score >= 80 ? '#1D9E75' : portfolio.score >= 50 ? '#EF9F27' : '#E24B4A'} size="md" />
              <DistributionRow label="منخفض" value={portfolio.distribution.low} total={productRiskData.length} color="bg-[var(--color-success)]" />
              <DistributionRow label="متوسط" value={portfolio.distribution.medium} total={productRiskData.length} color="bg-[var(--color-warning)]" />
              <DistributionRow label="مرتفع" value={portfolio.distribution.high} total={productRiskData.length} color="bg-[var(--color-danger)]" />
            </CardContent>
          </Card>
        </div>
      </>}

      <Card>
        <CardHeader className="border-b border-[var(--color-border)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle>مصفوفة مخاطر المنتجات</CardTitle><p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatNumber(filteredProducts.length)} منتج مطابق</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="بحث عن منتج" className="min-h-11 pr-9 sm:w-64" /></div>
              <Select value={riskFilter} onChange={event => { setRiskFilter(event.target.value); setPage(0); }} className="min-h-11 sm:w-44" aria-label="تصفية مستوى المخاطر">
                <option value="all">كل المستويات</option><option value="high">مرتفع</option><option value="medium">متوسط</option><option value="low">منخفض</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>المنتج</TableHead><TableHead>الدرجة</TableHead><TableHead>المستوى</TableHead><TableHead>حجم العينة</TableHead><TableHead>معدل الإرجاع</TableHead><TableHead>هامش الربح</TableHead><TableHead>نسبة CPA</TableHead><TableHead>الإجراء</TableHead>
          </TableRow></TableHeader><TableBody>
            {visibleProducts.map(product => <TableRow key={product.name} className={selectedProduct === product.name ? 'bg-[var(--color-primary)]/5' : ''} onClick={() => selectProduct(product.name)}>
              <TableCell className="max-w-64 truncate font-medium" title={product.name}>{product.name}</TableCell>
              <TableCell><RiskScore score={product.result.riskScore} /></TableCell>
              <TableCell><RiskBadge score={product.result.riskScore} label={product.result.riskLevel} /></TableCell>
              <TableCell className="tabular-nums">{formatNumber(product.sampleSize)}</TableCell>
              <TableCell className="tabular-nums">{product.inputs.cancellationRate.toFixed(1)}%</TableCell>
              <TableCell className={product.result.netMargin < 20 ? 'text-[var(--color-danger)] tabular-nums' : 'text-[var(--color-success)] tabular-nums'}>{product.result.netMargin.toFixed(1)}%</TableCell>
              <TableCell className="tabular-nums">{(product.inputs.adCostPerOrder / product.result.recommendedPrice * 100).toFixed(1)}%</TableCell>
              <TableCell><Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); selectProduct(product.name); }}>تحليل</Button></TableCell>
            </TableRow>)}
            {visibleProducts.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-[var(--color-text-muted)]">لا توجد منتجات مطابقة</TableCell></TableRow>}
          </TableBody></Table></div>
          {totalPages > 1 && <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">الصفحة {currentPage + 1} من {totalPages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>السابق</Button><Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}>التالي</Button></div>
          </div>}
        </CardContent>
      </Card>

      {selectedRisk && <Card id="risk-detail" className="scroll-mt-24">
        <CardHeader className="border-b border-[var(--color-border)]"><CardTitle>تحليل: {selectedRisk.product.name}</CardTitle><p className="text-xs text-[var(--color-text-muted)]">النتيجة تقديرية ومبنية على {formatNumber(selectedRisk.product.sampleSize)} طلب</p></CardHeader>
        <CardContent className="grid gap-6 py-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 p-5 dark:bg-gray-800/50"><RiskMeter score={selectedRisk.detail.score} level={selectedRisk.detail.level} color={selectedRisk.detail.color} size="lg" /></div>
          <div className="grid gap-3 sm:grid-cols-2">{selectedRisk.detail.factors.map(factor => <div key={factor.label} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{factor.label}</p><Badge variant={factor.penalty > 15 ? 'danger' : factor.penalty > 0 ? 'warning' : 'success'}>-{factor.penalty}</Badge></div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">الحالي: <strong className="text-[var(--color-text)]">{factor.currentValue}</strong> · المرجع: {factor.benchmark}</p><p className="mt-2 text-xs leading-5 text-[var(--color-warning)]">{factor.recommendation}</p>
          </div>)}</div>
        </CardContent>
      </Card>}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'primary' | 'success' | 'warning' | 'danger' }) {
  const colors = { primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]', success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]', warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' };
  return <Card><CardContent className="flex items-center gap-3 p-4 sm:p-5"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</span><span className="min-w-0"><span className="block truncate text-xs text-[var(--color-text-muted)]">{label}</span><span className="mt-1 block text-xl font-bold tabular-nums sm:text-2xl">{value}</span></span></CardContent></Card>;
}

function DistributionRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return <div><div className="mb-1.5 flex items-center justify-between text-xs"><span>{label}</span><span className="font-semibold tabular-nums">{formatNumber(value)} · {percentage.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} /></div></div>;
}

function RiskScore({ score }: { score: number }) {
  return <span className={score >= 80 ? 'font-bold text-[var(--color-success)] tabular-nums' : score >= 50 ? 'font-bold text-[var(--color-warning)] tabular-nums' : 'font-bold text-[var(--color-danger)] tabular-nums'}>{score}/100</span>;
}

function RiskBadge({ score, label }: { score: number; label: string }) {
  return <Badge variant={score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger'}>{label}</Badge>;
}
