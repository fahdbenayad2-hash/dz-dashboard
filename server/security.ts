const encoder = new TextEncoder();
export const COOKIE = '__Host-dz_session';
export const SESSION_SECONDS = 8 * 60 * 60;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function equalSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const left = new Uint8Array(x), right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_NOT_CONFIGURED');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueSession(now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(payload));
  return `${payload}.${Buffer.from(signature).toString('base64url')}`;
}

export async function authenticated(req: Request, now = Date.now()): Promise<boolean> {
  try {
    const value = req.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!value || value.length > 256) return false;
    const parts = value.split('.');
    if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
    const remaining = Number(parts[0]) - Math.floor(now / 1000);
    if (remaining <= 0 || remaining > SESSION_SECONDS) return false;
    return await crypto.subtle.verify('HMAC', await key(), Buffer.from(parts[2], 'base64url'), encoder.encode(parts.slice(0, 2).join('.')));
  } catch { return false; }
}

export function sameOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin;
}

export function sessionCookie(value: string, age = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
