/*
E2E verification script:
- Logs in (or registers) a user
- Ingests a high-risk failed-login event
- Polls alerts until the matching event_id produces an alert
- Asserts threat_type=brute_force_login and severity=critical

Usage:
  node scripts/verify-e2e.js

Env overrides:
  API_BASE=http://localhost:4000
  EMAIL=admin@example.com
  PASSWORD=password123
  TIMEOUT_MS=20000
  POLL_INTERVAL_MS=500
*/

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const DEFAULT_EMAIL = process.env.EMAIL || '';
const PASSWORD = process.env.PASSWORD || 'password123';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 20_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 500);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const headers = {
    accept: 'application/json',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await readJson(res);

  // Canonical API shape: { data: ..., error: null } OR { data: null, error: { message, code, ... } }
  // Backward-compat: allow older endpoints returning payload directly.
  const envelope = (() => {
    if (raw && typeof raw === 'object') {
      if ('data' in raw && 'error' in raw) return raw;

      // Legacy error shape: { error: '...', code: '...', requestId: '...' }
      if (typeof raw.error === 'string' && raw.error) {
        return {
          data: null,
          error: {
            message: raw.error,
            code: raw.code || 'request_error',
            ...(raw.requestId ? { requestId: raw.requestId } : {}),
            ...(raw.details !== undefined ? { details: raw.details } : {}),
          },
        };
      }
    }
    return { data: raw, error: null };
  })();

  return { status: res.status, ok: res.ok, data: envelope };
}

async function ensureLogin() {
  const rand = Math.floor(Math.random() * 1_000_000);
  const preferredEmail = DEFAULT_EMAIL || `e2e-${rand}@example.com`;

  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { email: preferredEmail, password: PASSWORD },
  });

  if (login.ok && login.data?.data?.token) return login.data.data.token;

  // If login failed, try register then login again.
  const reg = await requestJson('/api/auth/register', {
    method: 'POST',
    body: { email: preferredEmail, password: PASSWORD },
  });

  // If the preferred email is already in use with a different password,
  // fall back to a unique email to keep the E2E script deterministic.
  const finalEmail = reg.ok
    ? preferredEmail
    : DEFAULT_EMAIL
      ? preferredEmail
      : `e2e-${rand}-alt@example.com`;

  if (!reg.ok && finalEmail !== preferredEmail) {
    const reg2 = await requestJson('/api/auth/register', {
      method: 'POST',
      body: { email: finalEmail, password: PASSWORD },
    });
    if (!reg2.ok) {
      throw new Error(`Register failed: ${JSON.stringify(reg2.data)}`);
    }
  }

  const login2 = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { email: finalEmail, password: PASSWORD },
  });

  if (!login2.ok || !login2.data?.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(login2.data)}`);
  }

  return login2.data.data.token;
}

function buildBruteForceEvent() {
  // Make the event unique so alert grouping doesn't mask the assertion.
  const rand = Math.floor(Math.random() * 10_000);
  const ip = `185.23.12.${(rand % 200) + 1}`;
  const user = `admin-${rand}`;

  return {
    timestamp: new Date().toISOString(),
    source: 'auth-service',
    event_type: 'login_attempt',
    status: 'failed',
    message: `Failed login attempt (user=${user}, ip=${ip})`,
    network: { ip, user_agent: 'verify-e2e.js' },
    actor: { user },
    attributes: { attempts: 120 },
    tags: ['e2e'],
  };
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch() is not available. Use Node.js 18+ (or set up a fetch polyfill).');
  }

  console.log(`[verify-e2e] API_BASE=${API_BASE}`);
  console.log('[verify-e2e] Logging in (or registering)...');
  const token = await ensureLogin();
  console.log(`[verify-e2e] Auth OK (token prefix: ${token.slice(0, 16)}...)`);

  console.log('[verify-e2e] Ingesting high-risk brute-force event...');
  const ingestBody = buildBruteForceEvent();
  const ing = await requestJson('/api/logs', { method: 'POST', token, body: ingestBody });
  if (!ing.ok) {
    throw new Error(`Ingest failed (${ing.status}): ${JSON.stringify(ing.data)}`);
  }

  const eventId = ing.data?.data?.event_id;
  if (!eventId) {
    throw new Error(`Ingest response missing event_id: ${JSON.stringify(ing.data)}`);
  }

  console.log(`[verify-e2e] Ingested event_id=${eventId}`);
  console.log('[verify-e2e] Waiting for worker to process and create alert...');

  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const alerts = await requestJson('/api/alerts?limit=50', { token });
    if (alerts.ok) {
      const items = Array.isArray(alerts.data?.data?.items) ? alerts.data.data.items : [];
      const matches = items.filter((a) => a?.event_id === eventId);
      if (matches.length) {
        const expectedThreat = 'brute_force_login';
        const expectedSeverity = 'critical';

        const wanted = matches.find((a) => a?.threat_type === expectedThreat);
        if (wanted) {
          if (wanted.severity !== expectedSeverity) {
            throw new Error(
              `Alert severity mismatch for event_id=${eventId}. Expected ${expectedSeverity}, got ${wanted.severity}`
            );
          }

          console.log(
            `[verify-e2e] PASS: alert_id=${wanted._id} threat_type=${wanted.threat_type} severity=${wanted.severity}`
          );
          return;
        }
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const latest = await requestJson('/api/alerts?limit=10', { token });
  const sample = latest.ok ? latest.data?.data?.items : latest.data;
  throw new Error(
    `Timed out after ${TIMEOUT_MS}ms waiting for alert for event_id=${eventId}. Sample alerts: ${JSON.stringify(sample)}`
  );
}

main().catch((err) => {
  console.error(`[verify-e2e] FAIL: ${err?.message || err}`);
  process.exitCode = 1;
});
