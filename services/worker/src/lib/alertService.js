import { LogEvent } from '../models/LogEvent.js';
import { Alert } from '../models/Alert.js';
import { logger } from './logger.js';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_TICK_MS = 10_000;

async function getActiveUserIds({ now = new Date(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  const since = new Date(now.getTime() - Math.max(windowMs, 5 * 60_000));
  const userIds = await LogEvent.distinct('user_id', {
    user_id: { $exists: true, $type: 'string', $ne: '' },
    timestamp: { $gte: since },
  }).catch(() => []);
  return (Array.isArray(userIds) ? userIds : []).map((x) => String(x)).filter(Boolean);
}

function logInfo(message, meta) {
  logger.info({ component: 'alert-engine', ...(meta ?? {}) }, message);
}

function logError(message, meta) {
  logger.error({ component: 'alert-engine', ...(meta ?? {}) }, message);
}

function computeWindowStart(date, windowMs) {
  const t = date.getTime();
  return new Date(Math.floor(t / windowMs) * windowMs);
}

function buildGroupKey(type, metadata) {
  const ip = metadata?.ip ? String(metadata.ip) : 'global';
  return `${type}:${ip}`;
}

function pickTitle(type) {
  switch (type) {
    case 'HIGH_TRAFFIC':
      return 'High traffic detected';
    case 'HIGH_LATENCY':
      return 'High latency detected';
    case 'ERROR_SPIKE':
      return 'Error rate spike detected';
    case 'SUSPICIOUS_IP':
      return 'Suspicious IP activity detected';
    default:
      return 'Alert detected';
  }
}

function severityForRule(type, metrics) {
  // Baseline per spec.
  const base = {
    HIGH_TRAFFIC: 'high',
    HIGH_LATENCY: 'medium',
    ERROR_SPIKE: 'critical',
    SUSPICIOUS_IP: 'critical',
  }[type];

  // Bonus: minimal escalation logic (never downgrades below the required baseline).
  if (!base) return 'medium';

  if (type === 'HIGH_TRAFFIC' && Number(metrics?.requestsLastMinute) > 100) return 'critical';
  if (type === 'HIGH_LATENCY' && Number(metrics?.avgLatencyMs) > 600) return 'high';
  if (type === 'ERROR_SPIKE' && Number(metrics?.errorRate) > 0.25) return 'critical';
  if (type === 'SUSPICIOUS_IP' && Number(metrics?.requestsFromIp) > 60) return 'critical';

  return base;
}

async function getRepresentativeEventId(match) {
  // For aggregate alerts, pick a recent event as an anchor.
  const doc = await LogEvent.findOne(match).sort({ timestamp: -1 }).select({ _id: 1 });
  if (doc?._id) return doc._id;

  // Fallback: pick the most recent event overall.
  const uid = match?.user_id ? String(match.user_id) : null;
  const anyDoc = await LogEvent.findOne(uid ? { user_id: uid } : {}).sort({ timestamp: -1 }).select({ _id: 1 });
  return anyDoc?._id ?? null;
}

export async function getRequestsLastMinute({ userId, now = new Date(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) return 0;
  const start = new Date(now.getTime() - windowMs);
  const [result] = await LogEvent.aggregate([
    { $match: { user_id: uid, timestamp: { $gte: start, $lte: now } } },
    { $count: 'count' },
  ]);
  return result?.count ?? 0;
}

export async function getAverageLatency({ userId, now = new Date(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) return null;
  const start = new Date(now.getTime() - windowMs);
  const [result] = await LogEvent.aggregate([
    {
      $match: {
        user_id: uid,
        timestamp: { $gte: start, $lte: now },
      },
    },
    {
      $project: {
        latency: {
          $convert: {
            input: '$attributes.latency',
            to: 'double',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { latency: { $ne: null } } },
    { $group: { _id: null, avgLatencyMs: { $avg: '$latency' } } },
  ]);

  return typeof result?.avgLatencyMs === 'number' ? result.avgLatencyMs : null;
}

export async function getErrorRate({ userId, now = new Date(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) return { total: 0, failed: 0, errorRate: 0 };
  const start = new Date(now.getTime() - windowMs);
  const [result] = await LogEvent.aggregate([
    { $match: { user_id: uid, timestamp: { $gte: start, $lte: now } } },
    { $project: { statusLower: { $toLower: { $ifNull: ['$status', ''] } } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        failed: {
          $sum: {
            $cond: [{ $in: ['$statusLower', ['failed', 'error']] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        failed: 1,
        errorRate: {
          $cond: [{ $gt: ['$total', 0] }, { $divide: ['$failed', '$total'] }, 0],
        },
      },
    },
  ]);

  return {
    total: result?.total ?? 0,
    failed: result?.failed ?? 0,
    errorRate: result?.errorRate ?? 0,
  };
}

export async function getTopIPs({ userId, now = new Date(), windowMs = DEFAULT_WINDOW_MS, limit = 10 } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) return [];
  const start = new Date(now.getTime() - windowMs);
  const results = await LogEvent.aggregate([
    {
      $match: {
        user_id: uid,
        timestamp: { $gte: start, $lte: now },
        'network.ip': { $exists: true, $ne: null },
      },
    },
    { $group: { _id: '$network.ip', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, ip: '$_id', count: 1 } },
  ]);

  return Array.isArray(results) ? results : [];
}

export async function createAlert(alertData) {
  const now = new Date();
  const windowStart = computeWindowStart(now, DEFAULT_WINDOW_MS);
  const timestampMinute = computeWindowStart(now, 60_000);

  const userId = String(alertData?.user_id ?? '').trim();
  if (!userId) throw new Error('createAlert requires user_id');

  const type = String(alertData?.type ?? '').trim();
  if (!type) throw new Error('createAlert requires type');

  const metadata = alertData?.metadata && typeof alertData.metadata === 'object' ? alertData.metadata : {};
  const groupKey = buildGroupKey(type, metadata);

  // Rolling-window dedupe: same alert type/group within the last 60s.
  // (Avoids edge cases where minute-bucket dedupe would allow alerts a few seconds apart.)
  const dedupeSince = new Date(now.getTime() - DEFAULT_WINDOW_MS);
  const recentlyTriggered = await Alert.findOne({ user_id: userId, group_key: groupKey, status: 'open', createdAt: { $gte: dedupeSince } })
    .sort({ createdAt: -1 })
    .select({ _id: 1, createdAt: 1 });

  if (recentlyTriggered) {
    logInfo('alert deduped (rolling window)', {
      type,
      group_key: groupKey,
      since: dedupeSince.toISOString(),
      last: recentlyTriggered.createdAt?.toISOString?.(),
    });
    return null;
  }

  const severity = alertData?.severity;
  const message = String(alertData?.message ?? '').trim();
  const title = String(alertData?.title ?? '').trim() || pickTitle(type);

  const matchForEvent = {
    user_id: userId,
    timestamp: { $gte: new Date(now.getTime() - DEFAULT_WINDOW_MS), $lte: now },
    ...(metadata?.ip ? { 'network.ip': String(metadata.ip) } : {}),
  };

  const eventId = await getRepresentativeEventId(matchForEvent);

  if (!eventId) {
    // No logs at all; nothing to anchor the alert to.
    logInfo('skipping alert creation (no log events found)', { type, group_key: groupKey });
    return null;
  }

  // NOTE: existing Alert schema requires event_id, threat_type, group_key, reason, title.
  // We populate these to remain compatible with current dashboards/routes.
  const doc = {
    user_id: userId,
    event_id: eventId,

    timestamp_minute: timestampMinute,

    type,
    message: message || title,
    metadata,

    title,
    severity,
    status: 'open',

    threat_type: type,
    group_key: groupKey,
    reason: message || title,
    source_ip: metadata?.ip ? String(metadata.ip) : undefined,
    actor: 'system',

    event_count: 1,
    first_seen: now,
    last_seen: now,
    window_start: windowStart,
    counts: {
      occurrences: 1,
      first_seen_at: now,
      last_seen_at: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    const created = await Alert.create(doc);
    logInfo('alert created', { type, severity, group_key: groupKey, window_start: windowStart.toISOString() });
    return created;
  } catch (e) {
    // Dedupe via unique index: group_key + status + window_start.
    if (e && e.code === 11000) {
      logInfo('alert deduped (already created this window)', { type, group_key: groupKey, window_start: windowStart.toISOString() });
      return null;
    }
    throw e;
  }
}

export async function evaluateAlerts({ now = new Date() } = {}) {
  const userIds = await getActiveUserIds({ now });
  if (!userIds.length) {
    logInfo('tick complete', { tenants: 0, created: 0 });
    return { createdAlerts: [], tenants: 0 };
  }

  const createdAlerts = [];
  for (const userId of userIds) {
    // eslint-disable-next-line no-await-in-loop
    const requestsLastMinute = await getRequestsLastMinute({ userId, now });
    // eslint-disable-next-line no-await-in-loop
    const avgLatencyMs = await getAverageLatency({ userId, now });
    // eslint-disable-next-line no-await-in-loop
    const error = await getErrorRate({ userId, now });
    // eslint-disable-next-line no-await-in-loop
    const topIps = await getTopIPs({ userId, now });

    // A) HIGH_TRAFFIC
    if (requestsLastMinute > 50) {
      const severity = severityForRule('HIGH_TRAFFIC', { requestsLastMinute });
      const message = `Requests in last 60s: ${requestsLastMinute} (> 50)`;
      // eslint-disable-next-line no-await-in-loop
      const created = await createAlert({
        user_id: userId,
        type: 'HIGH_TRAFFIC',
        severity,
        title: pickTitle('HIGH_TRAFFIC'),
        message,
        metadata: { requestsLastMinute, windowSeconds: 60 },
      });
      if (created) createdAlerts.push(created);
    }

    // B) HIGH_LATENCY
    if (typeof avgLatencyMs === 'number' && avgLatencyMs > 300) {
      const severity = severityForRule('HIGH_LATENCY', { avgLatencyMs });
      const message = `Average latency last 60s: ${Math.round(avgLatencyMs)}ms (> 300ms)`;
      // eslint-disable-next-line no-await-in-loop
      const created = await createAlert({
        user_id: userId,
        type: 'HIGH_LATENCY',
        severity,
        title: pickTitle('HIGH_LATENCY'),
        message,
        metadata: { avgLatencyMs, windowSeconds: 60 },
      });
      if (created) createdAlerts.push(created);
    }

    // C) ERROR_SPIKE
    if (error.total > 0 && error.errorRate > 0.1) {
      const severity = severityForRule('ERROR_SPIKE', { errorRate: error.errorRate });
      const pct = Math.round(error.errorRate * 1000) / 10;
      const message = `Failed requests last 60s: ${error.failed}/${error.total} (${pct}%) (> 10%)`;
      // eslint-disable-next-line no-await-in-loop
      const created = await createAlert({
        user_id: userId,
        type: 'ERROR_SPIKE',
        severity,
        title: pickTitle('ERROR_SPIKE'),
        message,
        metadata: { failed: error.failed, total: error.total, errorRate: error.errorRate, windowSeconds: 60 },
      });
      if (created) createdAlerts.push(created);
    }

    // D) SUSPICIOUS_IP
    const suspicious = topIps.filter((x) => Number(x?.count) > 20 && x?.ip);
    for (const ipRow of suspicious) {
      const ip = String(ipRow.ip);
      const requestsFromIp = Number(ipRow.count);
      const severity = severityForRule('SUSPICIOUS_IP', { requestsFromIp });
      const message = `IP ${ip} sent ${requestsFromIp} requests in last 60s (> 20)`;

      // eslint-disable-next-line no-await-in-loop
      const created = await createAlert({
        user_id: userId,
        type: 'SUSPICIOUS_IP',
        severity,
        title: pickTitle('SUSPICIOUS_IP'),
        message,
        metadata: { ip, requestsFromIp, windowSeconds: 60 },
      });
      if (created) createdAlerts.push(created);
    }
  }

  logInfo('tick complete', {
    tenants: userIds.length,
    created: createdAlerts.length,
  });

  return {
    createdAlerts,
    tenants: userIds.length,
  };
}

export function startAlertEngine({ tickMs = DEFAULT_TICK_MS } = {}) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await evaluateAlerts({ now: new Date() });
    } catch (e) {
      logError('tick failed', { message: e?.message, stack: e?.stack });
    } finally {
      running = false;
    }
  }

  // Run quickly on startup, then every N seconds.
  tick().catch(() => undefined);
  const intervalId = setInterval(() => {
    tick().catch(() => undefined);
  }, tickMs);

  logInfo('started', { tickMs });

  return {
    stop() {
      clearInterval(intervalId);
      logInfo('stopped');
    },
  };
}
