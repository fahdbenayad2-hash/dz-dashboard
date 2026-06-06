import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE_URL = 'https://femmesoir.leaderscod.com';
const TOKEN = process.env.OCTOMATIC_TOKEN!;
const X_AUTH = process.env.OCTOMATIC_X_AUTH!;

async function fetchAllPages() {
  let allData: unknown[] = [];
  const limit = 100;
  let page = 0;
  let totalPages = 0;

  while (true) {
    const url = `${BASE_URL}/tenants/api/tracking-order?limit=${limit}&page=${page}`;
    console.log('[DZ-PROXY] tracking page=' + page + ' url=' + url);
    const res = await fetch(url, {
      headers: {
        'Authorization': TOKEN,
        'x-authorization': X_AUTH,
        'lang': 'ar',
      },
    });
    if (!res.ok) {
      console.log('[DZ-PROXY] tracking page=' + page + ' http=' + res.status + ' ' + res.statusText);
      const text = await res.text();
      console.log('[DZ-PROXY] tracking error body=' + text.slice(0, 500));
      break;
    }
    const json = await res.json();
    if (!json.data) {
      console.log('[DZ-PROXY] tracking page=' + page + ' no data key in response, keys=' + Object.keys(json).join(','));
      break;
    }
    console.log('[DZ-PROXY] tracking page=' + page + ' rows=' + json.data.length);
    if (json.data.length === 0) break;
    allData = [...allData, ...json.data];
    totalPages++;
    if (json.data.length < limit) break;
    page += 1;
  }

  console.log('[DZ-PROXY] tracking done: totalPages=' + totalPages + ' totalRows=' + allData.length);
  return allData;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const data = await fetchAllPages();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ data });
  } catch (err) {
    console.log('[DZ-PROXY] tracking fatal=' + String(err));
    res.status(500).json({ error: String(err) });
  }
}
