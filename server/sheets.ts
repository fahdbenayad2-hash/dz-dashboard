type Cell = { v: unknown; f?: string };
export type SheetRow = { c: Cell[] | null };
let cached: { key: string; token: string; expires: number } | undefined;
// Tokens are issued for each deployment request by Vercel and validated by Google STS.
// GOOGLE_WIF_AUDIENCE is a fixed provider resource name, never caller supplied.
async function accessToken(oidcToken?: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const audience = process.env.GOOGLE_WIF_AUDIENCE;
  if (!email || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(email) || !audience || !/^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[\w-]+\/providers\/[\w-]+$/.test(audience)) throw new Error('SHEETS_NOT_CONFIGURED');
  if (!oidcToken || oidcToken.length > 16384) throw new Error('OIDC_TOKEN_REQUIRED');
  const cacheKey = email + audience + oidcToken;
  if (cached?.key === cacheKey && cached.expires > Date.now() + 60000) return cached.token;
  const exchange = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audience, grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token', scope: 'https://www.googleapis.com/auth/cloud-platform', subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', subjectToken: oidcToken }),
  });
  if (!exchange.ok) throw new Error('SHEETS_FEDERATION_FAILED');
  const federated = await exchange.json() as { access_token?: string };
  if (typeof federated.access_token !== 'string' || !federated.access_token) throw new Error('SHEETS_AUTH_INVALID');
  const response = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(email)}:generateAccessToken`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + federated.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'], lifetime: '3600s' }),
  });
  if (!response.ok) throw new Error('SHEETS_IMPERSONATION_FAILED');
  const result = await response.json() as { accessToken?: string; expireTime?: string };
  const expires = Date.parse(result.expireTime || '');
  if (typeof result.accessToken !== 'string' || !result.accessToken || !Number.isFinite(expires) || expires <= Date.now()) throw new Error('SHEETS_AUTH_INVALID');
  cached = { key: cacheKey, token: result.accessToken, expires };
  return cached.token;
}

export async function fetchSheet(sheet: string, oidcToken?: string): Promise<SheetRow[]> {
  if (!['Orders', 'Tracking', 'SyncStatus'].includes(sheet)) throw new Error('UNKNOWN_SHEET');
  const id = process.env.SHEET_ID;
  if (!id || !/^[\w-]+$/.test(id)) throw new Error('SHEETS_NOT_CONFIGURED');
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheet + '!A:J')}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`, {
    headers: { Authorization: 'Bearer ' + await accessToken(oidcToken) }, cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('SHEETS_READ_FAILED');
  const result = await response.json() as { values?: unknown[][] };
  if (result.values !== undefined && !Array.isArray(result.values)) throw new Error('SHEETS_INVALID_RESPONSE');
  return (result.values || []).slice(1).map((row: unknown[]) => ({ c: row.map(v => ({ v })) }));
}

export async function fetchPublishedSheets(oidcToken?: string) {
  const before = await fetchSheet('SyncStatus', oidcToken);
  const generation = before[0]?.c?.[0]?.v;
  const completedAt = before[0]?.c?.[1]?.v;
  if (typeof generation !== 'string' || !generation || before[0]?.c?.[2]?.v !== 'completed') throw new Error('NO_COMPLETED_GENERATION');
  const [orders, tracking] = await Promise.all([fetchSheet('Orders', oidcToken), fetchSheet('Tracking', oidcToken)]);
  const after = await fetchSheet('SyncStatus', oidcToken);
  if (after[0]?.c?.[0]?.v !== generation || after[0]?.c?.[2]?.v !== 'completed') throw new Error('GENERATION_CHANGED_RETRY');
  return { Orders: orders, Tracking: tracking, generation, completedAt };
}
export async function fetchPublishedSheet(sheet: string, oidcToken?: string) {
  const data = await fetchPublishedSheets(oidcToken);
  if (sheet === 'Orders' || sheet === 'Tracking') return data[sheet];
  throw new Error('UNKNOWN_SHEET');
}
