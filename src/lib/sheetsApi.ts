import type { Order, OrderStatus, TrackingOrder, StatusCategory } from '@/types';

const SHEET_ID = '1WjloEKAQGJA2Z6vgnhni7aByN4ktmPc0xP7EvAUaMUw';

function fetchSheet(sheetName: string): Promise<{ c: { v: unknown; f?: string }[] | null }[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}&headers=1`;
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

export async function fetchTracking(): Promise<TrackingOrder[]> {
  const rows = await fetchSheet('Tracking');
  return rows
    .reduce((acc: TrackingOrder[], row: { c: { v: unknown; f?: string }[] | null }) => {
      const cells = row.c;
      if (!cells) return acc;
      // GAS writes: [Tracking ID, Order ID, Status, Date, Wilaya, Agent, Customer, Product, Total, Delivery]
      const orderId = String(cells[1]?.v || '');
      if (!orderId) return acc;
      const rawStatus = String(cells[2]?.v || '');
      const rawDate = String(cells[3]?.f || cells[3]?.v || '');
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const date = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
      acc.push({
        orderId,
        date,
        agent: String(cells[5]?.v || ''),
        customer: String(cells[6]?.v || ''),
        wilaya: String(cells[4]?.v || ''),
        trackingStatus: rawStatus,
        statusCategory: classifyTrackingStatus(rawStatus),
        product: String(cells[7]?.v || ''),
        total: Number(cells[8]?.v) || 0,
        delivery: Number(cells[9]?.v) || 0,
        driver: '',
      });
      return acc;
    }, []);
}
