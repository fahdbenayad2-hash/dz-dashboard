import { authenticated, json } from '../server/security';
import { fetchPublishedSheets } from '../server/sheets';
export const config = { runtime: 'edge' };
export default async function handler(req: Request) {
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!await authenticated(req)) return json({ error: 'UNAUTHORIZED' }, 401);
  try { return json(await fetchPublishedSheets(req.headers.get('x-vercel-oidc-token') || undefined)); }
  catch { return json({ error: 'SOURCE_UNAVAILABLE' }, 503); }
}
