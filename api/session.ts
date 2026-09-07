import { authenticated, equalSecret, issueSession, json, sameOrigin, sessionCookie } from '../server/security';
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return json({ authenticated: await authenticated(req) });
  if (!['POST', 'DELETE'].includes(req.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(req)) return json({ error: 'FORBIDDEN' }, 403);
  if (req.method === 'DELETE') return json({ authenticated: false }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || password.length < 16 || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return json({ error: 'AUTH_NOT_CONFIGURED' }, 503);
  // Vercel Firewall must enforce a distributed rate limit for this route.
  if (Number(req.headers.get('content-length')) > 2048) return json({ error: 'INVALID_REQUEST' }, 413);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: 'INVALID_REQUEST' }, 413);
    const input = JSON.parse(raw);
    if (typeof input.password !== 'string' || !await equalSecret(input.password, password)) return json({ error: 'INVALID_CREDENTIALS' }, 401);
    return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie(await issueSession()) });
  } catch { return json({ error: 'INVALID_REQUEST' }, 400); }
}
