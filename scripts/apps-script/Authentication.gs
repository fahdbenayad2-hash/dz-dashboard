/**
 * Replace the existing apiGet_ with this file; keep CONFIG and getXAuth.
 * No trigger or credentials are installed by this file.
 * Auto-login requires explicit OCTO_AUTO_LOGIN=true in Script Properties.
 */
function octoNormalizedToken_(token) {
  return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

function octoTokenExpiry_(token) {
  try {
    token = octoNormalizedToken_(token);
    var part = token.split('.')[1];
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString());
    return typeof payload.exp === 'number' && isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch (_) { return null; }
}

function octoToken_(rejectedToken) {
  var props = PropertiesService.getScriptProperties();
  var token = octoNormalizedToken_(props.getProperty('JWT_TOKEN'));
  var expiry = octoTokenExpiry_(token);
  if (!rejectedToken && token && (!expiry || expiry > Date.now() + 3600000)) return token;
  if (props.getProperty('OCTO_AUTO_LOGIN') !== 'true') throw new Error('AUTH_REQUIRED: renew the connection');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('AUTH_BUSY: retry later');
  try {
    token = octoNormalizedToken_(props.getProperty('JWT_TOKEN'));
    expiry = octoTokenExpiry_(token);
    if (token && token !== rejectedToken && (!expiry || expiry > Date.now() + 3600000)) return token;
    var previousAttempt = Number(props.getProperty('OCTO_AUTH_ATTEMPT_AT') || 0);
    if (Date.now() - previousAttempt < 300000) throw new Error('AUTH_BACKOFF: retry later');
    var account = props.getProperty('OCTO_LOGIN_ACCOUNT');
    var password = props.getProperty('OCTO_LOGIN_PASSWORD');
    var store = props.getProperty('OCTO_STORE_NAME');
    if (!account || !password || !store || !getXAuth()) throw new Error('AUTH_CONFIG: missing configuration');
    props.setProperty('OCTO_AUTH_ATTEMPT_AT', String(Date.now()));
    var response = UrlFetchApp.fetch('https://leaderscod.com/tenants/login', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: false,
      headers: { 'X-Authorization': getXAuth(), lang: 'ar' },
      payload: JSON.stringify({ phoneOrEmail: account, password: password, storeName: store }),
    });
    if (response.getResponseCode() !== 200) throw new Error('AUTH_LOGIN_FAILED: reconnect required');
    var result;
    try { result = JSON.parse(response.getContentText()); } catch (_) { throw new Error('AUTH_INVALID_RESPONSE'); }
    var stores = result.data && result.data.tenant && result.data.tenant.stores;
    var expectedDomain = CONFIG.BASE_URL.replace(/^https:\/\//, '').replace(/\/$/, '');
    if (!/^https:\/\/[^/]+\/?$/.test(CONFIG.BASE_URL)) throw new Error('AUTH_CONFIG: invalid origin');
    var matchingStore = Array.isArray(stores) && stores.some(function (item) {
      return item.store_name === store && item.domain === expectedDomain;
    });
    if (!matchingStore || typeof result.token !== 'string' || !result.token) throw new Error('AUTH_STORE_MISMATCH');
    var newExpiry = octoTokenExpiry_(result.token);
    if (newExpiry && newExpiry <= Date.now() + 3600000) throw new Error('AUTH_TOKEN_TOO_SHORT');
    // Test only the configured origin; never send a token to a returned domain.
    var check = UrlFetchApp.fetch(CONFIG.BASE_URL.replace(/\/$/, '') + '/tenants/api/me', {
      method: 'get', muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: 'Bearer ' + result.token, 'X-Authorization': getXAuth(), lang: 'ar' },
    });
    if (check.getResponseCode() !== 200) throw new Error('AUTH_VERIFICATION_FAILED');
    props.setProperty('JWT_TOKEN', result.token);
    props.setProperty('OCTO_AUTH_SUCCESS_AT', new Date().toISOString());
    return result.token;
  } catch (_) {
    // Never expose response bodies, passwords, headers or tokens in execution logs.
    throw new Error('AUTH_RENEWAL_FAILED: check connection settings');
  } finally { lock.releaseLock(); }
}

function apiGet_(endpoint, params) {
  // Only the two audited read endpoints are permitted by this adapter.
  if (endpoint !== '/tenants/api/orders' && endpoint !== '/tenants/api/tracking-order') throw new Error('UNSUPPORTED_ENDPOINT');
  var url = CONFIG.BASE_URL.replace(/\/$/, '') + endpoint;
  if (params) url += '?' + Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
  var token = octoToken_();
  var renewed = false;
  for (var attempt = 0; attempt < 3; attempt++) {
    var response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'get', muteHttpExceptions: true, followRedirects: false,
        headers: { Authorization: 'Bearer ' + token, 'X-Authorization': getXAuth(), lang: 'ar', Accept: 'application/json' },
      });
    } catch (_) {
      if (attempt === 2) throw new Error('API_NETWORK_FAILED');
      Utilities.sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    var code = response.getResponseCode();
    if (code === 200) {
      var data;
      try { data = JSON.parse(response.getContentText()); } catch (_) { throw new Error('API_INVALID_JSON'); }
      if (!data || !Array.isArray(data.data)) throw new Error('API_INVALID_SCHEMA');
      return data;
    }
    if (code === 401 && !renewed && attempt < 2) {
      token = octoToken_(token);
      renewed = true;
      continue;
    }
    if (code === 429 || code >= 500) {
      if (attempt === 2) throw new Error('API_RETRY_EXHAUSTED: ' + code);
      var headers = response.getHeaders();
      var retry = Number(headers['Retry-After'] || headers['retry-after']);
      // Do not occupy an Apps Script execution during a lengthy rate limit.
      if (retry > 10) throw new Error('API_RATE_LIMITED: retry in a later run');
      Utilities.sleep(Math.max(1000 * Math.pow(2, attempt), (retry || 0) * 1000));
      continue;
    }
    throw new Error('API_ACCESS_FAILED: ' + code);
  }
  throw new Error('API_RETRY_EXHAUSTED');
}
