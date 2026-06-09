import type { Order, OrderStatus, TrackingOrder, StatusCategory } from '@/types';

const BASE_URL = 'https://femmesoir.leaderscod.com';
const ORDERS_ENDPOINT = '/tenants/api/orders';
const TRACKING_ENDPOINT = '/tenants/api/tracking-order';
const ORDERS_LIMIT = 50;
const TRACKING_LIMIT = 70;

function getToken(): string {
  return localStorage.getItem('dz_jwt_token') || '';
}

function getXAuth(): string {
  return localStorage.getItem('dz_x_auth') || '';
}

function buildHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + getToken(),
    'x-authorization': getXAuth(),
    'lang': 'ar',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

export function setToken(token: string): void {
  localStorage.setItem('dz_jwt_token', token);
}

export function setXAuth(key: string): void {
  localStorage.setItem('dz_x_auth', key);
}

export function hasCredentials(): boolean {
  return !!getToken() && !!getXAuth();
}

async function apiGet<T>(endpoint: string, params: Record<string, number>): Promise<T | null> {
  const qs = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  const url = `${BASE_URL}${endpoint}?${qs}`;
  console.log('[DZ-API] fetching', endpoint, params);

  const resp = await fetch(url, { method: 'GET', headers: buildHeaders() });

  if (!resp.ok) {
    if (resp.status === 401) throw new Error('توكن غير صالح');
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  return (await resp.json()) as T;
}

interface ApiResponse<T> {
  data: T[];
  all_count?: number;
}

function parseOrderDate(dateStr: string): string {
  return (dateStr || '').split('T')[0].split(' ')[0].substring(0, 10);
}

async function fetchAllPages<T>(
  endpoint: string,
  limit: number,
  mapItem: (item: unknown) => T,
  getSortId?: (item: T) => number,
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;

  while (true) {
    const result = await apiGet<ApiResponse<unknown>>(endpoint, { offset: page, limit });

    if (!result || !result.data || result.data.length === 0) break;

    for (const item of result.data) {
      all.push(mapItem(item));
    }

    if (result.all_count && (page + 1) * limit >= result.all_count) break;
    if (result.data.length < limit) break;

    page++;
  }

  if (getSortId) {
    all.sort((a, b) => getSortId(b) - getSortId(a));
  }

  console.log(`[DZ-API] ${endpoint}: ${all.length} items fetched`);
  return all;
}

export async function fetchOrders(): Promise<Order[]> {
  return fetchAllPages<Order>(
    ORDERS_ENDPOINT, ORDERS_LIMIT,
    (item: unknown) => {
      const o = item as Record<string, unknown>;
      const customer = o.customer as Record<string, unknown> | undefined;
      const addrs = o.addrs as Record<string, unknown> | undefined;
      const wilaya = addrs?.wilaya as Record<string, unknown> | undefined;
      const productsOrder = (o.products_order as Record<string, unknown>[] | undefined)?.[0];
      const product = productsOrder?.product as Record<string, unknown> | undefined;
      const agent = o.agent as Record<string, unknown> | undefined;
      const statusOrder = o.status_order as Record<string, unknown> | undefined;

      return {
        id: Number(o.id) || 0,
        date: parseOrderDate(String(o.created_at || '')),
        customer: String(customer?.fullname || ''),
        phone: String(
          (customer?.phones as Record<string, unknown>[] | undefined)?.[0]?.phone || ''
        ),
        wilaya: String(wilaya?.name || ''),
        status: String(statusOrder?.name || 'Pending') as OrderStatus,
        product: String(product?.name || ''),
        total: Number(o.order_total || 0),
        delivery: Number(o.delivery_cost || 0),
        agent: String(agent?.fullname || ''),
      };
    },
    (o: Order) => o.id,
  );
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

export async function fetchTracking(): Promise<TrackingOrder[]> {
  return fetchAllPages<TrackingOrder>(
    TRACKING_ENDPOINT, TRACKING_LIMIT,
    (item: unknown) => {
      const t = item as Record<string, unknown>;
      const order = t.order as Record<string, unknown> | undefined;
      const confirmedBy = t.confirmed_by as Record<string, unknown> | undefined;
      const customer = order?.customer as Record<string, unknown> | undefined;
      const addrs = order?.addrs as Record<string, unknown> | undefined;
      const wilaya = addrs?.wilaya as Record<string, unknown> | undefined;
      const productsOrder = (order?.products_order as Record<string, unknown>[] | undefined)?.[0];
      const product = productsOrder?.product as Record<string, unknown> | undefined;

      const rawStatus = String(t.tracking_status || '');
      const rawDate = String(t.date_and_time || '');
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const date = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

      return {
        orderId: String(order?.id || t.id || ''),
        date,
        agent: String(confirmedBy?.fullname || ''),
        customer: String(customer?.fullname || ''),
        wilaya: String(wilaya?.name || ''),
        trackingStatus: rawStatus,
        statusCategory: classifyTrackingStatus(rawStatus),
        product: String(product?.name || ''),
        total: Number(order?.order_total || 0),
        delivery: Number(order?.delivery_cost || 0),
        driver: String(t.driver_name || ''),
      };
    },
    (t: TrackingOrder) => Number(t.orderId),
  );
}
