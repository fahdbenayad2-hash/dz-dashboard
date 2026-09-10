import type { OrderItem } from '@/types';
import { itemSubtotal } from '@/lib/orderItems';
import { formatCurrency } from '@/lib/utils';

export function OrderItems({ items = [], product, total, delivery }: { items?: OrderItem[]; product: string; total: number; delivery: number }) {
  const subtotal = itemSubtotal(items);
  return <details className="max-w-80 text-xs" onClick={event => event.stopPropagation()}>
    <summary className="cursor-pointer leading-6" title={product}>{items.length === 1 ? `${items[0].name} × ${items[0].quantity ?? '?'}` : items.length > 1 ? `${items.length} منتجات — عرض السلة` : product || 'تفاصيل غير متاحة'}</summary>
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border)] p-3">
      {items.map((item, index) => <div key={`${item.productId}-${index}`} className="border-b border-[var(--color-border)] pb-2">
        <p className="font-semibold">{item.name}</p>
        <p>{item.quantity ?? 'كمية غير متاحة'} × {item.unitPrice === null ? 'سعر غير متاح' : formatCurrency(item.unitPrice)}</p>
        {item.quantity !== null && item.unitPrice !== null && <p>{formatCurrency(item.quantity * item.unitPrice)}</p>}
      </div>)}
      {!items.length && <p>تفاصيل السلة غير موجودة في هذه النسخة من المصدر.</p>}
      {subtotal !== null && <><p>مجموع المنتجات: {formatCurrency(subtotal)}</p>{Math.abs(total - delivery - subtotal) > 0.01 && <p>فرق عن المبلغ المسجل (خصم أو تعديل يحتاج مراجعة): {formatCurrency(total - delivery - subtotal)}</p>}</>}
      <p>شحن الطلب مرة واحدة: {formatCurrency(delivery)}</p>
      <p className="font-bold">إجمالي الطلب: {formatCurrency(total)}</p>
    </div>
  </details>;
}
