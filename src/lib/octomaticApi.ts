import type { Order, OrderStatus, TrackingOrder, StatusCategory } from '@/types';
import { normalizeStatus } from '@/lib/dashboardMetrics';

function mapOrder(o: any): Order {
  const phone = o.customer?.phones?.[0]?.phone || '';
  return {
    id: Number(o.id) || 0,
    date: o.created_at || '',
    customer: o.customer?.fullname || '',
    phone: String(phone),
    wilaya: o.addrs?.wilaya?.name || '',
    status: normalizeStatus(o.status_order?.name || '') as OrderStatus,
    product: o.products_order?.[0]?.product?.name || '',
    total: Number(o.order_total || 0),
    delivery: Number(o.delivery_cost || 0),
    agent: o.agent?.fullname || '',
  };
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error(`Orders API error: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.data)) throw new Error('Invalid orders response');
  const orders = json.data.map(mapOrder);
  console.log('[DZ-SHEET] Orders: ' + orders.length + ' rows returned');
  return orders;
}

export function classifyTrackingStatus(status: string): StatusCategory {
  const s = (status || '').toString().trim().toLowerCase();
  const delivered = ['livré', 'livre', 'livrée', 'delivered', 'مسلم', 'تم التسليم'];
  const returned = ['retour', 'retourné', 'retournée', 'colis retourné', 'refus', 'refusé', 'refused', 'رجع', 'مرجع', 'إرجاع', 'annulé', 'ملغى', 'ملغي'];
  const transit = ['en transit', 'transit', 'في الطريق', 'vers', 'expédié', 'en cours', 'sorti', 'en route'];
  const delivery = ['en livraison', 'livraison', 'ramassé', 'en cours de livraison', 'camion', 'centre', 'توزيع', 'out for delivery', 'قيد التوزيع', 'prêt', 'en attente de ramassage'];

  if (delivered.some(w => s.includes(w))) return 'delivered';
  if (returned.some(w => s.includes(w))) return 'returned';
  if (transit.some(w => s.includes(w))) return 'transit';
  if (delivery.some(w => s.includes(w))) return 'delivery';
  return 'others';
}

function mapTracking(item: any): TrackingOrder {
  const rawDate = item.date_and_time || '';
  let date: Date | null = null;
  if (rawDate) {
    const parsed = new Date(rawDate.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) date = parsed;
  }
  const status = item.tracking_status || '';
  return {
    orderId: item.order?.id || '',
    date,
    agent: item.confirmed_by?.fullname || '',
    customer: item.order?.customer?.fullname || '',
    wilaya: item.order?.addrs?.wilaya?.name || '',
    trackingStatus: status,
    statusCategory: classifyTrackingStatus(status),
    product: item.order?.products_order?.[0]?.product?.name || '',
    total: Number(item.order?.order_total || 0),
    delivery: Number(item.order?.delivery_cost || 0),
    driver: item.driver_name || '',
  };
}

export async function fetchTracking(): Promise<TrackingOrder[]> {
  const res = await fetch('/api/tracking');
  if (!res.ok) throw new Error(`Tracking API error: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.data)) throw new Error('Invalid tracking response');
  const tracking = json.data.map(mapTracking);
  console.log('[DZ-SHEET] Tracking: ' + tracking.length + ' rows returned');
  return tracking;
}
