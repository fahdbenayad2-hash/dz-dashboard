import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE_URL = 'https://femmesoir.leaderscod.com';
const TOKEN = process.env.OCTOMATIC_TOKEN!;
const X_AUTH = process.env.OCTOMATIC_X_AUTH!;

async function fetchAllPages() {
  let allData: unknown[] = [];
  const limit = 50;
  let page = 0;
  let totalPages = 0;
  let totalCount: number | null = null;

  while (true) {
    const url = `${BASE_URL}/tenants/api/orders?limit=${limit}&page=${page}`;
    console.log('[DZ-PROXY] orders page=' + page + ' url=' + url);
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
      console.log('[DZ-PROXY] orders page=' + page + ' http=' + res.status + ' ' + res.statusText);
      const text = await res.text();
      console.log('[DZ-PROXY] orders error body=' + text.slice(0, 500));
      break;
    }
    const json = await res.json();
    if (page === 0) {
      console.log('[DZ-PROXY] orders page=0 keys=' + Object.keys(json).join(',') + ' all_count=' + json.all_count);
      totalCount = json.all_count ? Number(json.all_count) : null;
    }
    if (!json.data) {
      console.log('[DZ-PROXY] orders page=' + page + ' no data key, keys=' + Object.keys(json).join(','));
      break;
    }
    console.log('[DZ-PROXY] orders page=' + page + ' rows=' + json.data.length);
    if (json.data.length === 0) break;
    allData = [...allData, ...json.data];
    totalPages++;
    page += 1;
    if (totalCount !== null && allData.length >= totalCount) break;
    if (json.data.length < limit) break;
  }

  console.log('[DZ-PROXY] orders done: totalPages=' + totalPages + ' totalRows=' + allData.length + ' totalCount=' + totalCount);
  return allData;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const data = await fetchAllPages();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data });
  } catch (err) {
    console.log('[DZ-PROXY] orders fatal=' + String(err));
    res.status(500).json({ error: String(err) });
  }
}
