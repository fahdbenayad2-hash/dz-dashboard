import type { OrderItem, TrackingOrder } from '@/types';

// Verified against Octomatic order 26119: price 7600 × quantity 2 + delivery 800 = 16000.
export function parseOrderItems(raw: unknown): OrderItem[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.map((row): OrderItem => {
      const name = typeof row?.product?.name === 'string' ? row.product.name : 'منتج غير مسمّى';
      const quantity = row?.quantity == null || row.quantity === '' ? null : Number(row.quantity);
      const price = row?.price == null || row.price === '' ? null : Number(row.price);
      return { name, productId: String(row?.product_id ?? row?.product?.id ?? ''),
        quantity: quantity !== null && Number.isInteger(quantity) && quantity > 0 ? quantity : null,
        unitPrice: price !== null && Number.isFinite(price) && price >= 0 ? price : null };
    });
  } catch { return []; }
}

export function itemDescription(items: OrderItem[], fallback: string) {
  return items.length ? items.map(i => `${i.name} × ${i.quantity ?? '?'}`).join(' | ') : fallback;
}

export function itemSubtotal(items: OrderItem[]): number | null {
  if (!items.length || items.some(i => i.quantity === null || i.unitPrice === null)) return null;
  return items.reduce((sum, i) => sum + i.quantity! * i.unitPrice!, 0);
}

// Product-only view. Never feed expanded rows to order totals or agent reporting.
// Shipping and basket adjustments are allocated proportionally, with cent-level conservation.
export function expandProductOrders(orders: TrackingOrder[]): TrackingOrder[] {
  return orders.flatMap<TrackingOrder>(order => {
    const items = order.items ?? [];
    const subtotal = itemSubtotal(items);
    if (!items.length) return [{ ...order, items: undefined, product: order.product, itemDataMissing: true }];
    const grouped = new Map<string, { name: string; quantity: number; amount: number }>();
    for (const item of items) {
      const key = item.productId || item.name;
      const row = grouped.get(key) ?? { name: item.name, quantity: 0, amount: 0 };
      row.quantity += item.quantity ?? 0;
      row.amount += item.unitPrice !== null && item.quantity !== null ? item.unitPrice * item.quantity : 0;
      grouped.set(key, row);
    }
    if (subtotal === null || subtotal <= 0) return [...grouped.values()].map(item => ({
      ...order, product: item.name, items: undefined, quantity: item.quantity || undefined,
      total: 0, delivery: 0, itemDataMissing: true, basketAllocated: grouped.size > 1,
    }));
    let totalLeft = Math.round(order.total * 100), shippingLeft = Math.round(order.delivery * 100);
    return [...grouped.values()].map((item, index) => {
      const last = index === grouped.size - 1;
      const total = last ? totalLeft : Math.round(order.total * 100 * item.amount / subtotal);
      const shipping = last ? shippingLeft : Math.round(order.delivery * 100 * item.amount / subtotal);
      totalLeft -= total; shippingLeft -= shipping;
      return { ...order, product: item.name, items: undefined, quantity: item.quantity,
        total: total / 100, delivery: shipping / 100, itemDataMissing: false,
        basketAllocated: grouped.size > 1, orderShare: item.amount / subtotal };
    });
  });
}
