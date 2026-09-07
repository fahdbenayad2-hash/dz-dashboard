import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'reader@synthetic.iam.gserviceaccount.com');
  vi.stubEnv('GOOGLE_WIF_AUDIENCE', '//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel/providers/vercel');
  vi.stubEnv('SHEET_ID', 'synthetic-sheet');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function authResponse(url: string, options: RequestInit) {
  if (url.includes('sts.googleapis.com')) {
    const input = JSON.parse(options.body as string);
    expect(input.subjectToken).toBe('synthetic-vercel-token');
    expect(input.subjectTokenType).toBe('urn:ietf:params:oauth:token-type:jwt');
    return Response.json({ access_token: 'synthetic-federated-token' });
  }
  if (url.includes('iamcredentials.googleapis.com')) {
    const input = JSON.parse(options.body as string);
    expect(input.scope).toEqual(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    expect(input.lifetime).toBe('3600s');
    return Response.json({ accessToken: 'synthetic-google-token', expireTime: new Date(Date.now() + 3600000).toISOString() });
  }
}
it('exchanges request identity for read-only credentials and rejects changing generations', async () => {
  const { fetchPublishedSheets } = await import('./sheets');
  let statusReads = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const auth = authResponse(url, options); if (auth) return auth;
    expect(url).toContain('valueRenderOption=UNFORMATTED_VALUE');
    if (url.includes('SyncStatus')) return Response.json({ values: [['Generation', 'CompletedAt', 'Status'], [++statusReads === 1 ? 'old' : 'new', '2026-09-07T10:00:00Z', 'completed']] });
    return Response.json({ values: [['ID'], [1, '2026-09-07', '', '', '', '', '', 4750, 950]] });
  }));
  await expect(fetchPublishedSheets('synthetic-vercel-token')).rejects.toThrow('GENERATION_CHANGED');
});
it('rejects federation failure without leaking upstream response bodies', async () => {
  const { fetchSheet } = await import('./sheets');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('sensitive upstream details', { status: 401 })));
  await expect(fetchSheet('Orders', 'synthetic-vercel-token')).rejects.toThrow('SHEETS_FEDERATION_FAILED');
});
it('requires a completed generation before reading datasets', async () => {
  const { fetchPublishedSheets } = await import('./sheets');
  const fetcher = vi.fn(async (url: string, options: RequestInit) => authResponse(url, options) || Response.json({ values: [['Generation']] }));
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchPublishedSheets('synthetic-vercel-token')).rejects.toThrow('NO_COMPLETED_GENERATION');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('rejects arbitrary sheet ranges before making requests', async () => {
  const { fetchSheet } = await import('./sheets');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(fetchSheet('Secrets', 'synthetic-vercel-token')).rejects.toThrow('UNKNOWN_SHEET');
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not fall back to a static private key when request identity is missing', async () => {
  const { fetchSheet } = await import('./sheets');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('GOOGLE_PRIVATE_KEY', 'must-not-be-used');
  await expect(fetchSheet('Orders')).rejects.toThrow('OIDC_TOKEN_REQUIRED');
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects invalid provider resources before transmitting identity', async () => {
  const { fetchSheet } = await import('./sheets');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('GOOGLE_WIF_AUDIENCE', 'https://unexpected.example');
  await expect(fetchSheet('Orders', 'synthetic-vercel-token')).rejects.toThrow('SHEETS_NOT_CONFIGURED');
  expect(fetcher).not.toHaveBeenCalled();
});
