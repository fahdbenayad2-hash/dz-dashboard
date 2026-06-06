import type { VercelRequest, VercelResponse } from '@vercel/node';

// Force Vercel to never cache this function
export const config = {
  runtime: 'nodejs20.x',
};

const BASE_URL = 'https://femmesoir.leaderscod.com';
const TOKEN = process.env.OCTOMATIC_TOKEN!;
const X_AUTH = process.env.OCTOMATIC_X_AUTH!;

function setNoCacheHeaders(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', '*');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

async function fetchAllPages() {
  let allData: unknown[] = [];
  const limit = 500;
  let page = 1;
  let totalPages = 0;
  let totalCount: number | null = null;
  const ts = Date.now();

  while (true) {
    const url = `${BASE_URL}/tenants/api/CashOutRequests/getAll?limit=${limit}&page=${page}&_=${ts}`;
    console.log('[DZ-PROXY] orders page=' + page + ' url=' + url);
    const res = await fetch(url, {
      headers: {
        'Authorization': TOKEN,
        'x-authorization': X_AUTH,
        'lang': 'ar',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'x-cache-bust': String(ts),
      },
    });
    if (!res.ok) {
      console.log('[DZ-PROXY] orders page=' + page + ' http=' + res.status + ' ' + res.statusText);
      const text = await res.text();
      console.log('[DZ-PROXY] orders error body=' + text.slice(0, 500));
      if (res.status === 304) {
        console.log('[DZ-PROXY] orders page=' + page + ' GOT 304 despite no-cache headers — Octomatic API internal cache');
      }
      break;
    }
    const json = await res.json();
    if (page === 1) {
      totalCount = json.all_count ? Number(json.all_count) : null;
      const firstKeys = json.records?.[0] ? Object.keys(json.records[0]).join(',') : 'no_records';
      console.log('[DZ-PROXY] orders page=1 keys=' + Object.keys(json).join(',') + ' all_count=' + totalCount + ' records_len=' + (json.records ? json.records.length : 'no_records_key') + ' first_record_keys=' + firstKeys);
    }
    if (!json.records) {
      console.log('[DZ-PROXY] orders page=' + page + ' no records key, keys=' + Object.keys(json).join(','));
      break;
    }
    console.log('[DZ-PROXY] orders page=' + page + ' rows=' + json.records.length + ' totalSoFar=' + allData.length + '/' + totalCount);
    if (json.records.length === 0) break;
    allData = [...allData, ...json.records];
    totalPages++;
    page += 1;
    if (json.records.length < limit) break;
  }

  console.log('[DZ-PROXY] orders done: totalPages=' + totalPages + ' totalRows=' + allData.length + ' all_count=' + totalCount);
  return allData;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  console.log('[DZ-PROXY] REAL HIT orders handler');
  try {
    const data = await fetchAllPages();
    setNoCacheHeaders(res);
    res.json({ data });
  } catch (err) {
    console.log('[DZ-PROXY] orders fatal=' + String(err));
    setNoCacheHeaders(res);
    res.status(500).json({ error: String(err) });
  }
}
