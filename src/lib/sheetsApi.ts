import type { Order, OrderStatus, TrackingOrder } from '@/types';
import { parseOrderItems, itemDescription } from './orderItems';

import { classifyTrackingStatus } from './status';
export { classifyTrackingStatus } from './status';

type SheetRows = { c: { v: unknown; f?: string }[] | null }[];
type PublishedData = { Orders: SheetRows; Tracking: SheetRows; generation: string; completedAt: string };
let pending: Promise<PublishedData> | null = null;
let validUntil = 0;
export function resetDataCache() { pending = null; validUntil = 0; }
export function readPublishedData(): Promise<PublishedData> {
  if (pending && Date.now() < validUntil) return pending;
  validUntil = Date.now() + 30000;
  const request = fetch('/api/data', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000) })
    .then(async response => {
      if (!response.ok) throw new Error('Sheet request failed');
      const data = await response.json();
      if (!Array.isArray(data.Orders) || !Array.isArray(data.Tracking) || typeof data.generation !== 'string' || typeof data.completedAt !== 'string') throw new Error('Invalid sheet response');
      validUntil = Date.now() + 2000;
      return data as PublishedData;
    }).catch(error => { if (pending === request) resetDataCache(); throw error; });
  pending = request;
  return request;
}
async function fetchSheet(sheetName: 'Orders' | 'Tracking', signal?: AbortSignal): Promise<SheetRows> {
  const data = await readPublishedData();
  signal?.throwIfAborted();
  return data[sheetName];
}

export async function fetchOrders(signal?: AbortSignal): Promise<Order[]> {
  const rows = await fetchSheet('Orders', signal);
  return rows
    .reduce((acc: Order[], row: { c: { v: unknown; f?: string }[] | null }) => {
      const cells = row.c;
      if (!cells) return acc;
      const id = Number(cells[0]?.v) || 0;
      if (id <= 0) return acc;
      const items = parseOrderItems(cells[10]?.v);
      acc.push({
        id,
        date: String(cells[1]?.f || cells[1]?.v || ''),
        customer: String(cells[2]?.v || ''),
        phone: String(cells[3]?.v || ''),
        wilaya: String(cells[4]?.v || ''),
        status: String(cells[5]?.v || 'Pending') as OrderStatus,
        product: itemDescription(items, String(cells[6]?.v || '')),
        items,
        total: Number(cells[7]?.v) || 0,
        delivery: Number(cells[8]?.v) || 0,
        agent: String(cells[9]?.v || ''),
      });
      return acc;
    }, []);
}

export async function fetchTracking(signal?: AbortSignal): Promise<TrackingOrder[]> {
  const rows = await fetchSheet('Tracking', signal);
  return rows
    .reduce((acc: TrackingOrder[], row: { c: { v: unknown; f?: string }[] | null }) => {
      const cells = row.c;
      if (!cells) return acc;
      // gviz columns: [0] Order ID | [1] Date | [2] Agent | [3] Customer | [4] Wilaya | [5] Tracking Status | [6] Product | [7] Total | [8] Delivery | [9] Driver
      const orderId = String(cells[0]?.v || '');
      if (!orderId) return acc;
      const rawStatus = String(cells[5]?.v || '');
      const rawDate = String(cells[1]?.f || cells[1]?.v || '');
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const date = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
      const items = parseOrderItems(cells[10]?.v);
      acc.push({
        orderId,
        date,
        agent: String(cells[2]?.v || ''),
        customer: String(cells[3]?.v || ''),
        wilaya: String(cells[4]?.v || ''),
        trackingStatus: rawStatus,
        statusCategory: classifyTrackingStatus(rawStatus),
        product: itemDescription(items, String(cells[6]?.v || '')),
        items,
        total: Number(cells[7]?.v) || 0,
        delivery: Number(cells[8]?.v) || 0,
        driver: String(cells[9]?.v || ''),
      });
      return acc;
    }, []);
}
