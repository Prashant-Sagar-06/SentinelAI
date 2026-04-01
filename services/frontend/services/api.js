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

/* =========================
   REQUEST WITH TIMEOUT + RETRY
========================= */

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function requestJson(path, { method = 'GET', token, signal, retries = 1 } = {}) {
  const url = `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;

  let attempt = 0;

  while (true) {
    try {
      const res = await fetchWithTimeout(url, {
        method,
        headers: buildHeaders({ token }),
        signal,
      });

      const body = await parseBody(res);

      if (!res.ok) {
        const msg = (() => {
          if (typeof body === 'string' && body) return body;
          if (body && typeof body === 'object') {
            if (body.error && typeof body.error === 'object') {
              return String(
                body.error.message ||
                body.error.code ||
                body.message ||
                `Request failed (${res.status})`
              );
            }
            if (typeof body.error === 'string') return body.error;
            if (typeof body.message === 'string') return body.message;
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

      if ('data' in body && 'error' in body) {
        return body.data;
      }

      return body;

    } catch (err) {
      const isRetryable =
        err.name === 'AbortError' ||
        (err.status >= 500 && err.status < 600);

      if (attempt < retries && isRetryable) {
        attempt++;
        continue;
      }

      const error = new Error(err.message || 'Request failed');
      error.cause = err;
      throw error;
    }
  }
}

/* =========================
   HELPERS
========================= */

function normalizeLegacyArgs(firstArg, secondArg, idKey) {
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

/* =========================
   API METHODS
========================= */

export async function getAnomalies(limitOrOptions, maybeOptions) {
  try {
    const opts =
      limitOrOptions && typeof limitOrOptions === 'object'
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

    return await requestJson(`/api/copilot/explain/${encodeURIComponent(id)}`, {
      token,
      signal,
    });
  } catch (e) {
    throw withMeaningfulError(e, 'Failed to load anomaly explanation');
  }
}

export async function getResponses(anomalyIdOrOptions, maybeOptions) {
  try {
    const { id: anomalyId, token, signal, limit } =
      normalizeLegacyArgs(anomalyIdOrOptions, maybeOptions, 'anomalyId');

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