import type { Order, OrderStatus, TrackingOrder, StatusCategory } from '@/types';

const SHEET_ID = '1WjloEKAQGJA2Z6vgnhni7aByN4ktmPc0xP7EvAUaMUw';

function fetchSheet(sheetName: string): Promise<{ c: { v: unknown; f?: string }[] | null }[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&headers=1`;
  return fetch(url)
    .then(r => r.text())
    .then(text => {
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
      if (!match) throw new Error('Failed to parse Google Sheets response');
      const response = JSON.parse(match[1]);
      if (response.status === 'error') throw new Error(response.errors?.[0]?.message || 'Sheet API error');
      const rows = response.table.rows || [];
      console.log(`[DZ-SHEET] ${sheetName}: ${rows.length} rows returned`);
      if (rows.length > 0) console.log(`[DZ-SHEET] ${sheetName} first row sample:`, rows[0]);
      return rows;
    });
}

export async function fetchOrders(): Promise<Order[]> {
  const rows = await fetchSheet('Orders');
  return rows
    .reduce((acc: Order[], row: { c: { v: unknown; f?: string }[] | null }) => {
      const cells = row.c;
      if (!cells) return acc;
      const id = Number(cells[0]?.v) || 0;
      if (id <= 0) return acc;
      acc.push({
        id,
        date: String(cells[1]?.f || cells[1]?.v || ''),
        customer: String(cells[2]?.v || ''),
        phone: String(cells[3]?.v || ''),
        wilaya: String(cells[4]?.v || ''),
        status: String(cells[5]?.v || 'Pending') as OrderStatus,
        product: String(cells[6]?.v || ''),
        total: Number(cells[7]?.v) || 0,
        delivery: Number(cells[8]?.v) || 0,
        agent: String(cells[9]?.v || ''),
      });
      return acc;
    }, []);
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

// FIX BUG 2 — parse date strings with Algeria timezone (UTC+1)
function parseTrackingDate(raw: unknown): Date | null {
  const str = String(raw || '').trim();
  if (!str) return null;
  // If no timezone info, treat as UTC+1 (Algeria)
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(str);
  const normalized = hasTz ? str : str.replace(' ', 'T') + '+01:00';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// FIX BUG 1 — fetch all monthly tracking tabs in parallel
async function fetchMonthKeys(): Promise<string[]> {
  try {
    const rows = await fetchSheet('Tracking-Index');
    return rows
      .map(r => r.c ? String(r.c[0]?.v || '').trim() : '')
      .filter(k => /^\d{4}-\d{2}$/.test(k));
  } catch {
    return [];
  }
}

async function fetchTrackingSheet(monthKey: string): Promise<TrackingOrder[]> {
  const sheetName = 'Tracking-' + monthKey;
  let rows;
  try {
    rows = await fetchSheet(sheetName);
  } catch {
    return [];
  }
  return rows.reduce((acc: TrackingOrder[], row) => {
    const cells = row.c;
    if (!cells) return acc;
    const orderId = String(cells[0]?.v || '');
    if (!orderId) return acc;
    const rawStatus = String(cells[5]?.v || '');
    const rawDate = String(cells[1]?.f || cells[1]?.v || '');
    const date = parseTrackingDate(rawDate);
    acc.push({
      orderId,
      date,
      agent: String(cells[2]?.v || ''),
      customer: String(cells[3]?.v || ''),
      wilaya: String(cells[4]?.v || ''),
      trackingStatus: rawStatus,
      statusCategory: classifyTrackingStatus(rawStatus),
      product: String(cells[6]?.v || ''),
      total: Number(cells[7]?.v) || 0,
      delivery: Number(cells[8]?.v) || 0,
      driver: String(cells[9]?.v || ''),
    });
    return acc;
  }, []);
}

export async function fetchTracking(): Promise<TrackingOrder[]> {
  const monthKeys = await fetchMonthKeys();
  if (monthKeys.length === 0) return [];
  const results = await Promise.all(monthKeys.map(k => fetchTrackingSheet(k)));
  const all = results.flat();
  all.sort((a, b) => {
    const bTime = b.date ? b.date.getTime() : 0;
    const aTime = a.date ? a.date.getTime() : 0;
    return bTime - aTime;
  });
  console.log(`[DZ-TRACKING] ${all.length} records across ${monthKeys.length} months`);
  return all;
}
