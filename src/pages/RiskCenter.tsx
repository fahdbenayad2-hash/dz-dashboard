import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Search, ShieldCheck, Siren } from 'lucide-react';
import type { TrackingOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { expandProductOrders } from '@/lib/orderItems';
import { formatNumber } from '@/lib/utils';

type Level = 'low' | 'medium' | 'high' | 'insufficient';
type ProductRisk = { name: string; orders: number; units: number; delivered: number; returned: number; settled: number; deliveryRate: number | null; score: number | null; level: Level };
const PAGE_SIZE = 25;

function aggregate(tracking: TrackingOrder[]): ProductRisk[] {
  const rows = new Map<string, Omit<ProductRisk, 'deliveryRate' | 'score' | 'level'>>();
  for (const order of expandProductOrders(tracking)) {
    if (!order.product) continue;
    const row = rows.get(order.product) ?? { name: order.product, orders: 0, units: 0, delivered: 0, returned: 0, settled: 0 };
    row.orders += 1;
    row.units += order.quantity ?? 0;
    if (order.statusCategory === 'delivered') { row.delivered += 1; row.settled += 1; }
    if (order.statusCategory === 'returned') { row.returned += 1; row.settled += 1; }
    rows.set(order.product, row);
  }
  return [...rows.values()].map(row => {
    const deliveryRate = row.settled ? row.delivered / row.settled * 100 : null;
    // Small samples stay close to neutral instead of looking falsely safe or dangerous.
    const confidence = Math.min(1, row.settled / 30);
    const score = deliveryRate === null ? null : Math.round(50 + (deliveryRate - 50) * confidence);
    const level: Level = row.settled < 10 ? 'insufficient' : score! >= 70 ? 'low' : score! >= 50 ? 'medium' : 'high';
    return { ...row, deliveryRate, score, level };
  }).sort((a, b) => (a.score ?? 50) - (b.score ?? 50) || b.orders - a.orders);
}

const levelLabel: Record<Level, string> = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع', insufficient: 'عينة ناقصة' };
const levelVariant = (level: Level) => level === 'low' ? 'success' as const : level === 'high' ? 'danger' as const : level === 'medium' ? 'warning' as const : 'default' as const;

export function RiskCenter({ trackingOrders }: { trackingOrders: TrackingOrder[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const products = useMemo(() => aggregate(trackingOrders), [trackingOrders]);
  const summary = useMemo(() => ({
    high: products.filter(product => product.level === 'high').length,
    medium: products.filter(product => product.level === 'medium').length,
    low: products.filter(product => product.level === 'low').length,
    insufficient: products.filter(product => product.level === 'insufficient').length,
  }), [products]);
  const filtered = useMemo(() => products.filter(product => (!search.trim() || product.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && (filter === 'all' || product.level === filter)), [products, search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const detail = products.find(product => product.name === selected) ?? null;

  return <div className="space-y-5">
    <p className="text-sm leading-6 text-[var(--color-text-muted)]">المخاطر هنا تشغيلية ومبنية فقط على الطلبات المحسومة في Octomatic. أزلنا تقديرات القماش والإعلانات والهامش الثابتة لأنها لم تكن بيانات فعلية. أقل من 10 طلبات محسومة يظهر كعينة ناقصة.</p>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Summary icon={<Siren className="h-5 w-5" />} label="مخاطر مرتفعة" value={summary.high} tone="danger" />
      <Summary icon={<AlertTriangle className="h-5 w-5" />} label="مخاطر متوسطة" value={summary.medium} tone="warning" />
      <Summary icon={<ShieldCheck className="h-5 w-5" />} label="مخاطر منخفضة" value={summary.low} tone="success" />
      <Summary icon={<Boxes className="h-5 w-5" />} label="عينة ناقصة" value={summary.insufficient} tone="primary" />
    </div>
    <Card>
      <CardHeader className="border-b border-[var(--color-border)]"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>مخاطر المنتجات</CardTitle><p className="mt-1 text-xs text-[var(--color-text-muted)]">الدرجة تعدّل معدل التوصيل حسب حجم العينة حتى 30 طلباً محسومًا</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="بحث عن منتج" className="pr-9 sm:w-64" /></div><Select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}><option value="all">كل المستويات</option><option value="high">مرتفع</option><option value="medium">متوسط</option><option value="low">منخفض</option><option value="insufficient">عينة ناقصة</option></Select></div></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الطلبات</TableHead><TableHead>القطع المعروفة</TableHead><TableHead>المحسوم</TableHead><TableHead>مسلّم</TableHead><TableHead>مرتجع</TableHead><TableHead>التوصيل من المحسوم</TableHead><TableHead>المستوى</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader><TableBody>
        {visible.map(product => <TableRow key={product.name} onClick={() => setSelected(product.name)} className="cursor-pointer"><TableCell className="max-w-72 truncate font-medium" title={product.name}>{product.name}</TableCell><TableCell>{formatNumber(product.orders)}</TableCell><TableCell>{formatNumber(product.units)}</TableCell><TableCell>{formatNumber(product.settled)}</TableCell><TableCell className="text-[var(--color-success)]">{formatNumber(product.delivered)}</TableCell><TableCell className="text-[var(--color-danger)]">{formatNumber(product.returned)}</TableCell><TableCell>{product.deliveryRate === null ? 'غير متاح' : `${product.deliveryRate.toFixed(1)}%`}</TableCell><TableCell><Badge variant={levelVariant(product.level)}>{levelLabel[product.level]}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); setSelected(product.name); }}>عرض</Button></TableCell></TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-[var(--color-text-muted)]">لا توجد نتائج</TableCell></TableRow>}
      </TableBody></Table></div>{pages > 1 && <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4"><span className="text-sm text-[var(--color-text-muted)]">{current + 1} / {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!current} onClick={() => setPage(value => value - 1)}>السابق</Button><Button size="sm" variant="outline" disabled={current + 1 >= pages} onClick={() => setPage(value => value + 1)}>التالي</Button></div></div>}</CardContent>
    </Card>
    {detail && <Card><CardHeader><CardTitle>{detail.name}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Fact label="حجم القرار" value={`${formatNumber(detail.settled)} طلب محسوم`} /><Fact label="المعدل الخام" value={detail.deliveryRate === null ? 'غير متاح' : `${detail.deliveryRate.toFixed(1)}% توصيل`} /><Fact label="الدرجة بعد ضبط العينة" value={detail.score === null ? 'غير متاح' : `${detail.score}/100`} /><p className="sm:col-span-3 text-sm text-[var(--color-text-muted)]">{detail.level === 'insufficient' ? 'اجمع 10 طلبات محسومة على الأقل قبل اتخاذ قرار.' : detail.level === 'high' ? 'راجع جودة المنتج، وصف العرض، الولايات وشركة التوصيل قبل زيادة الميزانية.' : detail.level === 'medium' ? 'حسّن الولايات أو الحملات الأضعف وراقب 20 طلباً محسومًا إضافياً.' : 'الأداء التشغيلي مستقر؛ راقب الهامش من صفحة التحليل المالي قبل التوسعة.'}</p></CardContent></Card>}
  </div>;
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'success' | 'warning' | 'danger' }) {
  const colors = { primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]', success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]', warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' };
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</span><span><span className="block text-xs text-[var(--color-text-muted)]">{label}</span><strong className="text-2xl tabular-nums">{formatNumber(value)}</strong></span></CardContent></Card>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--color-border)] p-4"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-2 font-bold">{value}</p></div>; }
