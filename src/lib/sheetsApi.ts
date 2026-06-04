import type { Order, OrderStatus } from '@/types';

export async function fetchOrders(): Promise<Order[]> {
  const SHEET_ID = '1WjloEKAQGJA2Z6vgnhni7aByN4ktmPc0xP7EvAUaMUw';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Orders&headers=1`;

  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);

  if (!match) {
    throw new Error('Failed to parse Google Sheets response');
  }

  const json = JSON.parse(match[1]);
  const rows = json.table.rows || [];

  return rows
    .map((row: { c: { v: unknown; f?: string }[] | null }) => {
      const cells = row.c;
      if (!cells) return null;

      return {
        id: Number(cells[0]?.v) || 0,
        date: cells[1]?.f || cells[1]?.v || '',
        customer: String(cells[2]?.v || ''),
        phone: String(cells[3]?.v || ''),
        wilaya: String(cells[4]?.v || ''),
        status: (String(cells[5]?.v || 'Pending')) as OrderStatus,
        product: String(cells[6]?.v || ''),
        total: Number(cells[7]?.v) || 0,
        delivery: Number(cells[8]?.v) || 0,
        agent: String(cells[9]?.v || ''),
      };
    })
    .filter((o: Order | null): o is Order => o !== null && o.id > 0);
}
