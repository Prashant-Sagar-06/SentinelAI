const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

function getApiBase() {
  return String(API_BASE).replace(/\/$/, '');
}

export { API_BASE };

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStoredToken() {
  if (!isBrowser()) return '';
  try {
    return window.localStorage.getItem('sentinelai_token') || '';
  } catch {
    return '';
  }
}

function buildHeaders({ token, extraHeaders } = {}) {
  const resolvedToken = token || getStoredToken();
  const headers = {
    accept: 'application/json',
    ...extraHeaders,
  };
  if (resolvedToken) headers.authorization = `Bearer ${resolvedToken}`;
  return headers;
}

async function parseBody(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => ({}));
  }
  return res.text().catch(() => '');
}

async function requestJson(path, { method = 'GET', token, signal } = {}) {
  const url = `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: buildHeaders({ token }),
    });
  } catch (cause) {
    const err = new Error(`Network error while calling ${url}`);
    err.cause = cause;
    throw err;
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const msg = (() => {
      if (typeof body === 'string' && body) return body;
      if (body && typeof body === 'object') {
        if (body.error && typeof body.error === 'object') {
          return String(body.error.message || body.error.code || body.message || `Request failed (${res.status})`);
        }
        if (typeof body.error === 'string' && body.error) return body.error;
        if (typeof body.message === 'string' && body.message) return body.message;
      }
      return `Request failed (${res.status})`;
    })();
    const err = new Error(msg);
    err.status = res.status;
    err.url = url;
    err.body = body;
    throw err;
  }

  if (typeof body !== 'object' || body === null) return {};

  // New canonical API shape: { data: ..., error: null }
  if ('data' in body && 'error' in body) {
    return body.data;
  }

  // Backward-compat: older endpoints returned the payload directly.
  return body;
}

function normalizeLegacyArgs(firstArg, secondArg, idKey) {
  // Backward compatibility:
  // - old style: fn({ token, id/anomalyId, signal, limit })
  // - new style: fn(id, { token, signal, limit }) or fn(undefined, opts)
  if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
    const { token, signal, limit } = firstArg;
    const id = firstArg[idKey];
    return { id, token, signal, limit };
  }
  const id = firstArg;
  const { token, signal, limit } = secondArg || {};
  return { id, token, signal, limit };
}

function withMeaningfulError(err, fallbackMessage) {
  if (err instanceof Error) {
    if (!err.message) err.message = fallbackMessage;
    return err;
  }
  return new Error(fallbackMessage);
}

// REQUIRED EXPORTS

export async function getAnomalies(limitOrOptions, maybeOptions) {
  try {
    // Supported call patterns:
    // - getAnomalies()                       -> default limit
    // - getAnomalies(50)                     -> numeric limit
    // - getAnomalies({ token, limit, signal }) (legacy)
    const opts =
      limitOrOptions && typeof limitOrOptions === 'object' && !Array.isArray(limitOrOptions)
        ? limitOrOptions
        : { ...(maybeOptions || {}), limit: limitOrOptions };
    const limit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 20;
    return await requestJson(`/api/anomalies?limit=${encodeURIComponent(limit)}`, {
      token: opts.token,
      signal: opts.signal,
    });
  } catch (e) {
    throw withMeaningfulError(e, 'Failed to fetch anomalies');
  }
}

export async function getAnomalyExplanation(idOrOptions, maybeOptions) {
  try {
    const { id, token, signal } = normalizeLegacyArgs(idOrOptions, maybeOptions, 'id');
    if (!id) throw new Error('Missing anomaly id');
    return await requestJson(`/api/copilot/explain/${encodeURIComponent(id)}`, { token, signal });
  } catch (e) {
    throw withMeaningfulError(e, 'Failed to load anomaly explanation');
  }
}

export async function getResponses(anomalyIdOrOptions, maybeOptions) {
  try {
    const { id: anomalyId, token, signal, limit } = normalizeLegacyArgs(anomalyIdOrOptions, maybeOptions, 'anomalyId');
    if (!anomalyId) throw new Error('Missing anomaly id');
    const lim = limit ?? 50;
    return await requestJson(
      `/api/responses?anomaly_id=${encodeURIComponent(anomalyId)}&limit=${encodeURIComponent(lim)}`,
      { token, signal }
    );
  } catch (e) {
    throw withMeaningfulError(e, 'Failed to load responses');
  }
}
