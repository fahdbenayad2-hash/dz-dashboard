import { useState, useMemo } from 'react';
import type { Order } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { RiskMeter } from '@/components/shared/RiskMeter';
import { usePricing } from '@/hooks/usePricing';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Copy, RotateCcw } from 'lucide-react';

function useProductData(orders: Order[]) {
  return useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    orders.forEach(o => {
      if (!o.product) return;
      const existing = map.get(o.product) || { orders: 0, revenue: 0 };
      existing.orders++;
      existing.revenue += o.total;
      map.set(o.product, existing);
    });
    return [...map.entries()]
      .map(([name, d]) => ({ name, orders: d.orders, revenue: d.revenue, avgValue: d.orders > 0 ? d.revenue / d.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);
}

export function Products({ orders }: { orders: Order[] }) {
  const products = useProductData(orders);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const {
    inputs, result, riskDetail, updateInput, resetInputs,
  } = usePricing();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.recommendedPrice.toLocaleString('ar-DZ'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-7rem)]">
      {/* Left Panel - Product List */}
      <div className="w-72 shrink-0 overflow-y-auto space-y-3">
        <Card>
          <CardHeader><CardTitle>المنتجات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {products.map(p => (
              <button
                key={p.name}
                onClick={() => setSelectedProduct(p.name)}
                className={`w-full text-right rounded-lg p-3 text-sm transition-colors border ${
                  selectedProduct === p.name
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <p className="font-medium text-[var(--color-text)] truncate">{p.name}</p>
                <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
                  <span>{p.orders} طلب</span>
                  <span>{formatCurrency(p.revenue)}</span>
                </div>
              </button>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                لا توجد منتجات
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Pricing Calculator */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Hero Card */}
        <Card className="bg-gradient-to-br from-[var(--color-primary)] to-blue-700 text-white border-none">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <p className="text-blue-100 text-lg">السعر الموصى به</p>
              <p className="text-5xl font-bold tabular-nums">
                {result.recommendedPrice.toLocaleString('ar-DZ')} د.ج
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'تم النسخ' : 'نسخ السعر'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>المدخلات</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetInputs}>
                <RotateCcw className="h-4 w-4" />
                إعادة تعيين
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">تكاليف المنتج</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">سعر المتر</label>
                    <Input type="number" value={inputs.fabricPricePerMeter} onChange={e => updateInput('fabricPricePerMeter', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">عدد الأمتار</label>
                    <Input type="number" step="0.1" value={inputs.fabricMeters} onChange={e => updateInput('fabricMeters', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">تكلفة الخياطة</label>
                    <Input type="number" value={inputs.sewingCost} onChange={e => updateInput('sewingCost', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">الإكسسوارات</label>
                    <Input type="number" value={inputs.accessoriesCost} onChange={e => updateInput('accessoriesCost', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">تكاليف نوست (Logistics)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">التخزين</label>
                    <Input type="number" value={inputs.storageCost} onChange={e => updateInput('storageCost', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">التغليف</label>
                    <Input type="number" value={inputs.packagingCost} onChange={e => updateInput('packagingCost', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">رسوم الشحن</label>
                    <Input type="number" value={inputs.shippingFee} onChange={e => updateInput('shippingFee', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">تكلفة المرتجع</label>
                    <Input type="number" value={inputs.returnCost} onChange={e => updateInput('returnCost', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">رسوم COD</p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-[var(--color-text-muted)]">النوع</label>
                    <Select value={inputs.codType} onChange={e => updateInput('codType', e.target.value as 'percentage' | 'fixed')}>
                      <option value="percentage">نسبة %</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-[var(--color-text-muted)]">القيمة</label>
                    <Input type="number" step="0.1" value={inputs.codValue} onChange={e => updateInput('codValue', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">تكلفة الإعلان</p>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)]">تكلفة إعلان/طلب</label>
                  <Input type="number" value={inputs.adCostPerOrder} onChange={e => updateInput('adCostPerOrder', Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">المخاطر والهدف</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">معدل الإلغاء %</label>
                    <Input type="number" step="0.1" value={inputs.cancellationRate} onChange={e => updateInput('cancellationRate', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">الربح المطلوب/طلب</label>
                    <Input type="number" value={inputs.desiredProfit} onChange={e => updateInput('desiredProfit', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            {/* Price Tiers */}
            <Card>
              <CardHeader><CardTitle>شرائح السعر</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'الحد الأدنى', price: result.minPrice, color: 'var(--color-text-muted)' },
                  { label: 'عدواني', price: result.aggressivePrice, color: 'var(--color-warning)' },
                  { label: 'موصى به', price: result.recommendedPrice, color: 'var(--color-primary)', bold: true },
                  { label: 'ممتاز', price: result.premiumPrice, color: 'var(--color-purple)' },
                ].map(tier => (
                  <div
                    key={tier.label}
                    className={`flex items-center justify-between rounded-lg p-3 border ${
                      tier.bold ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)]'
                    }`}
                  >
                    <span className="text-sm text-[var(--color-text-muted)]">{tier.label}</span>
                    <span
                      className={`tabular-nums ${tier.bold ? 'text-lg font-bold' : 'font-medium'}`}
                      style={{ color: tier.color }}
                    >
                      {formatCurrency(Math.round(tier.price))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Metrics */}
            <Card>
              <CardHeader><CardTitle>المؤشرات المالية</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">صافي الربح/طلب</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-success)]">
                    {formatCurrency(Math.round(result.netProfit))}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">هامش الربح الصافي</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-primary)]">
                    {formatPercent(result.netMargin)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">نقطة التعادل</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-warning)]">
                    {formatCurrency(Math.round(result.breakEven))}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">الهامش الإجمالي</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-purple)]">
                    {formatPercent(result.grossMargin)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Risk Score */}
            <Card>
              <CardHeader><CardTitle>مؤشر المخاطر</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-6">
                <RiskMeter score={result.riskScore} level={result.riskLevel} color={result.riskColor} size="md" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    التقييم: <span className="font-semibold" style={{ color: result.riskColor }}>{result.riskLevel}</span>
                  </p>
                  {riskDetail.factors.filter(f => f.penalty > 0).slice(0, 3).map(f => (
                    <div key={f.label} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text-muted)]">{f.label}</span>
                      <Badge variant="warning">{f.penalty}- نقطة</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cost Breakdown Bar */}
        <Card>
          <CardHeader><CardTitle>توزيع التكاليف</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-8 rounded-lg overflow-hidden">
              {[
                { label: 'المنتج', value: result.costBreakdown.product.percentage, color: '#378ADD' },
                { label: 'اللوجستيك', value: result.costBreakdown.logistics.percentage, color: '#1D9E75' },
                { label: 'الإعلانات', value: result.costBreakdown.ads.percentage, color: '#EF9F27' },
                { label: 'المرتجعات', value: result.costBreakdown.returns.percentage, color: '#E24B4A' },
                { label: 'COD', value: result.costBreakdown.cod.percentage, color: '#7F77DD' },
                { label: 'الربح', value: result.costBreakdown.profit.percentage, color: '#1D9E75' },
              ].map(item => (
                <Tooltip key={item.label} content={`${item.label}: ${item.value.toFixed(1)}%`}>
                  <div
                    style={{ width: `${Math.max(item.value, 2)}%`, backgroundColor: item.color }}
                    className="h-full transition-all duration-300 cursor-pointer hover:opacity-80"
                  />
                </Tooltip>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
              {[
                { label: 'المنتج', value: result.costBreakdown.product.percentage, color: '#378ADD' },
                { label: 'اللوجستيك', value: result.costBreakdown.logistics.percentage, color: '#1D9E75' },
                { label: 'الإعلانات', value: result.costBreakdown.ads.percentage, color: '#EF9F27' },
                { label: 'المرتجعات', value: result.costBreakdown.returns.percentage, color: '#E24B4A' },
                { label: 'COD', value: result.costBreakdown.cod.percentage, color: '#7F77DD' },
                { label: 'الربح', value: result.costBreakdown.profit.percentage, color: '#1D9E75' },
              ].map(item => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  {item.label}: {item.value.toFixed(1)}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
