import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE_URL = 'https://femmesoir.leaderscod.com';
const TOKEN = process.env.OCTOMATIC_TOKEN!;
const X_AUTH = process.env.OCTOMATIC_X_AUTH!;

async function fetchAllPages() {
  let allData: unknown[] = [];
  const limit = 500;
  let page = 1;
  let totalPages = 0;
  let totalCount: number | null = null;

  while (true) {
    const url = `${BASE_URL}/tenants/api/tracking-order?limit=${limit}&page=${page}`;
    console.log('[DZ-PROXY] tracking page=' + page + ' url=' + url);
    const res = await fetch(url, {
      headers: {
        'Authorization': TOKEN,
        'x-authorization': X_AUTH,
        'lang': 'ar',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) {
      console.log('[DZ-PROXY] tracking page=' + page + ' http=' + res.status + ' ' + res.statusText);
      const text = await res.text();
      console.log('[DZ-PROXY] tracking error body=' + text.slice(0, 500));
      break;
    }
    const json = await res.json();
    if (page === 1) {
      console.log('[DZ-PROXY] tracking page=1 keys=' + Object.keys(json).join(',') + ' all_count=' + json.all_count + ' records_len=' + (json.records ? json.records.length : 'no_records_key'));
    }
    if (!json.records) {
      console.log('[DZ-PROXY] tracking page=' + page + ' no records key, keys=' + Object.keys(json).join(','));
      break;
    }
    console.log('[DZ-PROXY] tracking page=' + page + ' rows=' + json.records.length);
    if (json.records.length === 0) break;
    allData = [...allData, ...json.records];
    totalPages++;
    page += 1;
    if (json.all_count !== undefined && Number(json.all_count) > 0 && allData.length >= Number(json.all_count)) break;
    if (json.records.length < limit) break;
  }

  console.log('[DZ-PROXY] tracking done: totalPages=' + totalPages + ' totalRows=' + allData.length + ' all_count=' + totalCount);
  return allData;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const data = await fetchAllPages();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data });
  } catch (err) {
    console.log('[DZ-PROXY] tracking fatal=' + String(err));
    res.status(500).json({ error: String(err) });
  }
}
