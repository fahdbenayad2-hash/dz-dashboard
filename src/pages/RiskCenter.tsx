import { useMemo, useState } from 'react';
import type { Order, PricingInputs } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RiskMeter } from '@/components/shared/RiskMeter';
import { calculatePricing } from '@/lib/financialEngine';
import { getRiskDetail, calculatePortfolioRisk } from '@/lib/riskScore';
import { normalizeStatus } from '@/lib/dashboardMetrics';
import { formatCurrency, formatPercent } from '@/lib/utils';

function makePricingInputs(product: string, orders: Order[]): PricingInputs {
  const productOrders = orders.filter(o => o.product === product);
  const total = productOrders.length;
  const failed = productOrders.filter(o => normalizeStatus(o.status) === 'Failed').length;
  const cancelRate = total > 0 ? (failed / total) * 100 : 37;
  const avgTotal = total > 0 ? productOrders.reduce((s, o) => s + o.total, 0) / total : 2000;

  return {
    fabricPricePerMeter: 450,
    fabricMeters: 2.5,
    sewingCost: 400,
    accessoriesCost: 50,
    storageCost: 58,
    packagingCost: 50,
    shippingFee: 300,
    returnCost: 300,
    codType: 'percentage',
    codValue: 3.5,
    adCostPerOrder: Math.max(200, avgTotal * 0.25),
    cancellationRate: Math.min(cancelRate, 80),
    desiredProfit: 500,
  };
}

export function RiskCenter({ orders }: { orders: Order[] }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const productRiskData = useMemo(() => {
    const productNames = [...new Set(orders.map(o => o.product).filter(Boolean))];

    return productNames.map(name => {
      const inputs = makePricingInputs(name, orders);
      const result = calculatePricing(inputs);
      return { name, inputs, result };
    }).sort((a, b) => a.result.riskScore - b.result.riskScore);
  }, [orders]);

  const portfolioHealth = useMemo(() => {
    if (productRiskData.length === 0) return null;
    return calculatePortfolioRisk(productRiskData.map(p => ({ name: p.name, inputs: p.inputs })));
  }, [productRiskData]);

  const selectedRisk = useMemo(() => {
    if (!selectedProduct) return null;
    const product = productRiskData.find(p => p.name === selectedProduct);
    if (!product) return null;
    return getRiskDetail(product.inputs, product.result);
  }, [selectedProduct, productRiskData]);

  return (
    <div className="space-y-6">
      {/* Portfolio Health */}
      {portfolioHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>صحة المحفظة</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center">
              <RiskMeter score={portfolioHealth.overallScore} level={
                portfolioHealth.overallScore >= 80 ? 'منخفض' : portfolioHealth.overallScore >= 50 ? 'متوسط' : 'مرتفع'
              } color={
                portfolioHealth.overallScore >= 80 ? '#1D9E75' : portfolioHealth.overallScore >= 50 ? '#EF9F27' : '#E24B4A'
              } size="lg" />
            </CardContent>
          </Card>
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle>توزيع المخاطر</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-[var(--color-success)]" /> منخفض</span>
                    <span className="font-bold tabular-nums text-[var(--color-success)]">{portfolioHealth.distribution.low}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]" /> متوسط</span>
                    <span className="font-bold tabular-nums text-[var(--color-warning)]">{portfolioHealth.distribution.medium}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" /> مرتفع</span>
                    <span className="font-bold tabular-nums text-[var(--color-danger)]">{portfolioHealth.distribution.high}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {portfolioHealth.urgentFixes.map((fix, i) => (
              <Card key={i}>
                <CardHeader><CardTitle>إجراء {i + 1}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-[var(--color-danger)]">{fix.product}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{fix.action}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Product Risk Matrix */}
      <Card>
        <CardHeader><CardTitle>مصفوفة مخاطر المنتجات</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>درجة المخاطرة</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead>معدل الإلغاء</TableHead>
                  <TableHead>هامش الربح</TableHead>
                  <TableHead>نسبة CPA</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {productRiskData.map(p => {
                const isSelected = selectedProduct === p.name;
                return (
                  <TableRow
                    key={p.name}
                    className={`cursor-pointer ${
                      isSelected ? 'bg-[var(--color-primary)]/5' :
                      p.result.riskScore < 50 ? 'bg-[var(--color-danger)]/5' :
                      p.result.riskScore < 80 ? 'bg-[var(--color-warning)]/5' : ''
                    }`}
                    onClick={() => setSelectedProduct(p.name)}
                  >
                    <TableCell className="font-medium max-w-48 truncate">{p.name}</TableCell>
                    <TableCell>
                      <span className={`tabular-nums font-bold ${
                        p.result.riskScore >= 80 ? 'text-[var(--color-success)]' :
                        p.result.riskScore >= 50 ? 'text-[var(--color-warning)]' :
                        'text-[var(--color-danger)]'
                      }`}>
                        {p.result.riskScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        p.result.riskScore >= 80 ? 'success' :
                        p.result.riskScore >= 50 ? 'warning' : 'danger'
                      }>
                        {p.result.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.inputs.cancellationRate.toFixed(1)}%</TableCell>
                    <TableCell className={`tabular-nums ${p.result.netMargin < 20 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                      {p.result.netMargin.toFixed(1)}%
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {(p.inputs.adCostPerOrder / p.result.recommendedPrice * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProduct(p.name); }}>
                        تحليل
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {productRiskData.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-[var(--color-text-muted)] py-8">لا توجد منتجات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Risk Detail Panel */}
      {selectedRisk && selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle>تحليل مخاطر: {selectedProduct}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="flex flex-col items-center justify-center">
                <RiskMeter score={selectedRisk.score} level={selectedRisk.level} color={selectedRisk.color} size="lg" />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <p className="font-semibold">تفصيل العوامل (5 عوامل)</p>
                {selectedRisk.factors.map(f => (
                  <div key={f.label} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        الخسارة: <span className="text-[var(--color-danger)] font-medium">{f.penalty}</span> نقطة
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                      <span>الحالي: <span className="font-medium text-[var(--color-text)]">{f.currentValue}</span></span>
                      <span>المرجع: <span className="font-medium text-[var(--color-text)]">{f.benchmark}</span></span>
                    </div>
                    <p className="text-xs mt-1 text-[var(--color-warning)]">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Plan */}
            <div className="mt-6">
              <p className="font-semibold mb-3">خطة العمل</p>
              <div className="space-y-2">
                {selectedRisk.actionPlan.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm">{action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Urgent Fixes */}
            {portfolioHealth && portfolioHealth.urgentFixes.length > 0 && (
              <div className="mt-6">
                <p className="font-semibold text-[var(--color-danger)] mb-3">الإصلاحات الأكثر إلحاحًا</p>
                <div className="space-y-2">
                  {portfolioHealth.urgentFixes.map((fix, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-3">
                      <span className="text-sm font-medium">{fix.product}</span>
                      <span className="text-xs text-[var(--color-danger)]">{fix.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
