import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE_URL = 'https://femmesoir.leaderscod.com';
const TOKEN = process.env.OCTOMATIC_TOKEN!;
const X_AUTH = process.env.OCTOMATIC_X_AUTH!;

async function fetchAllPages() {
  let allData: unknown[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${BASE_URL}/tenants/api/orders?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': TOKEN,
        'x-authorization': X_AUTH,
        'lang': 'ar',
      },
    });
    const json = await res.json();
    if (!json.data || json.data.length === 0) break;
    allData = [...allData, ...json.data];
    if (json.data.length < limit) break;
    offset += limit;
  }

  return allData;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const data = await fetchAllPages();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
