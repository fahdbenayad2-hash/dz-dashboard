import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs20.x' };

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
  const limit = 50;
  let offset = 0;
  let totalPages = 0;
  const ts = Date.now();

  while (true) {
    const url = `${BASE_URL}/tenants/api/orders?limit=${limit}&offset=${offset}&_=${ts}`;
    console.log('[DZ-PROXY] orders offset=' + offset + ' url=' + url);
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
      console.log('[DZ-PROXY] orders offset=' + offset + ' http=' + res.status + ' ' + res.statusText);
      const text = await res.text();
      console.log('[DZ-PROXY] orders error body=' + text.slice(0, 500));
      if (res.status === 304) console.log('[DZ-PROXY] orders GOT 304 despite no-cache');
      break;
    }
    const json = await res.json();
    if (offset === 0) {
      const firstKeys = json.data?.[0] ? Object.keys(json.data[0]).join(',') : 'no_data';
      console.log('[DZ-PROXY] orders offset=0 keys=' + Object.keys(json).join(',') + ' all_count=' + json.all_count + ' data_len=' + (json.data ? json.data.length : 'no_data_key') + ' first_record_keys=' + firstKeys);
    }
    if (!json.data) {
      console.log('[DZ-PROXY] orders offset=' + offset + ' no data key, keys=' + Object.keys(json).join(','));
      break;
    }
    console.log('[DZ-PROXY] orders offset=' + offset + ' rows=' + json.data.length + ' totalSoFar=' + allData.length);
    if (json.data.length === 0) break;
    allData = [...allData, ...json.data];
    totalPages++;
    offset += 1;
    if (json.data.length < limit) break;
  }

  console.log('[DZ-PROXY] orders done: totalPages=' + totalPages + ' totalRows=' + allData.length);
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
