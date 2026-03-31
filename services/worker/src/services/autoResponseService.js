import { Response } from '../models/Response.js';
import { LogEvent } from '../models/LogEvent.js';

const ONE_MINUTE_MS = 60_000;

function logInfo(message, meta) {
  // eslint-disable-next-line no-console
  console.log(`[auto-response] ${message}`, meta ?? '');
}

function logError(message, meta) {
  // eslint-disable-next-line no-console
  console.error(`[auto-response] ${message}`, meta ?? '');
}

function floorToMinute(d) {
  const ms = typeof d?.getTime === 'function' ? d.getTime() : Date.now();
  return new Date(Math.floor(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

async function getTopSourceIpForMinute({ userId, minuteStart }) {
  const uid = String(userId ?? '').trim();
  const start = new Date(minuteStart);
  const end = new Date(start.getTime() + ONE_MINUTE_MS);

  const matchCount = await LogEvent.countDocuments({
    ...(uid ? { user_id: uid } : {}),
    timestamp: { $gte: start, $lt: end },
  }).catch(() => null);

  const rows = await LogEvent.aggregate([
    {
      $match: {
        ...(uid ? { user_id: uid } : {}),
        timestamp: { $gte: start, $lt: end },
        'network.ip': { $type: 'string', $ne: '' },
      },
    },
    { $group: { _id: '$network.ip', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  const top = Array.isArray(rows) && rows.length ? rows[0] : null;
  const topIp = top?._id ? String(top._id) : null;
  logInfo('matched logs', { start: start.toISOString(), end: end.toISOString(), matchCount, top_ip: topIp, top_count: top?.count ?? null });
  return topIp;
}

async function persistResponse({ userId, anomalyId, timestamp_minute = null, action, target = null, status = 'executed', message = '', metadata = {}, now }) {
  const uid = String(userId ?? '').trim();

  const filter = {
    anomaly_id: anomalyId,
    action,
    target: target ?? null,
  };

  const createdAt = now ?? new Date();
  const update = {
    $setOnInsert: {
      user_id: uid || null,
      anomaly_id: anomalyId,
      timestamp_minute: timestamp_minute ?? null,
      action,
      target: target ?? null,
      status,
      message,
      metadata,
      createdAt,
    },
  };

  const result = await Response.updateOne(filter, update, { upsert: true });
  if (result?.upsertedCount === 1) {
    const doc = await Response.findOne(filter).lean();
    return { created: true, doc };
  }
  return { created: false, deduped: true };
}

async function triggerBlockIP({ userId, anomalyId, ip, now, metadata }) {
  if (!ip) {
    return persistResponse({
      userId,
      anomalyId,
      timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
      action: 'BLOCK_IP',
      target: null,
      status: 'skipped',
      message: 'No source IP available to block; action simulated but skipped',
      metadata,
      now,
    });
  }

  // Simulation only.
  logInfo('simulated BLOCK_IP', { anomaly_id: String(anomalyId), ip });
  return persistResponse({
    userId,
    anomalyId,
    timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
    action: 'BLOCK_IP',
    target: ip,
    status: 'executed',
    message: `Simulated block of IP ${ip}`,
    metadata,
    now,
  });
}

async function triggerRateLimitIP({ userId, anomalyId, ip, now, metadata }) {
  if (!ip) {
    return persistResponse({
      userId,
      anomalyId,
      timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
      action: 'RATE_LIMIT_IP',
      target: null,
      status: 'skipped',
      message: 'No source IP available to rate-limit; action simulated but skipped',
      metadata,
      now,
    });
  }

  logInfo('simulated RATE_LIMIT_IP', { anomaly_id: String(anomalyId), ip });
  return persistResponse({
    userId,
    anomalyId,
    timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
    action: 'RATE_LIMIT_IP',
    target: ip,
    status: 'executed',
    message: `Simulated rate-limit for IP ${ip}`,
    metadata,
    now,
  });
}

async function raiseAlert({ userId, anomalyId, now, metadata }) {
  logInfo('simulated RAISE_ALERT', { anomaly_id: String(anomalyId) });
  return persistResponse({
    userId,
    anomalyId,
    timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
    action: 'RAISE_ALERT',
    target: 'global',
    status: 'executed',
    message: 'Simulated critical alert escalation',
    metadata,
    now,
  });
}

async function logIncident({ userId, anomalyId, now, metadata }) {
  logInfo('simulated LOG_INCIDENT', { anomaly_id: String(anomalyId) });
  return persistResponse({
    userId,
    anomalyId,
    timestamp_minute: metadata?.derived?.timestamp_minute ?? null,
    action: 'LOG_INCIDENT',
    target: 'global',
    status: 'executed',
    message: 'Simulated incident log entry',
    metadata,
    now,
  });
}

export async function handleAutoResponse(anomaly, metrics, { now = new Date() } = {}) {
  if (!anomaly || !anomaly._id) return { executed: false, reason: 'missing_anomaly' };

  const userId = String(anomaly.user_id ?? '').trim();

  const severity = String(anomaly.severity ?? '').toLowerCase();
  const errorRate = Number(metrics?.error_rate ?? metrics?.errorRate ?? 0);

  // Source-of-truth: anomaly.timestamp_minute (must match metrics_minute.timestamp_minute).
  // Back-compat fallback only if missing.
  const anomalyMinuteParsed = anomaly?.timestamp_minute ? new Date(anomaly.timestamp_minute) : null;
  const metaMinuteParsed = anomaly?.metadata?.current?.timestamp_minute ? new Date(anomaly.metadata.current.timestamp_minute) : null;

  const minuteStart = anomalyMinuteParsed && !Number.isNaN(anomalyMinuteParsed.getTime())
    ? floorToMinute(anomalyMinuteParsed)
    : metaMinuteParsed && !Number.isNaN(metaMinuteParsed.getTime())
      ? floorToMinute(metaMinuteParsed)
      : floorToMinute(now);

  logInfo('window', { anomaly_id: String(anomaly._id), start: minuteStart.toISOString(), end: new Date(minuteStart.getTime() + ONE_MINUTE_MS).toISOString() });
  const topIp = await getTopSourceIpForMinute({ userId, minuteStart }).catch((e) => {
    logError('top ip lookup failed', { message: e?.message });
    return null;
  });

  const metadata = {
    anomaly: {
      severity: anomaly.severity ?? null,
      score: typeof anomaly.score === 'number' ? anomaly.score : null,
      type: anomaly.type ?? null,
      createdAt: anomaly.createdAt ?? null,
    },
    metrics: {
      requests: Number(metrics?.requests ?? 0),
      error_rate: Number(metrics?.error_rate ?? 0),
      avg_latency: Number(metrics?.avg_latency ?? 0),
      unique_ips: Number(metrics?.unique_ips ?? 0),
    },
    derived: {
      top_source_ip: topIp,
      minute_start: minuteStart.toISOString(),
      timestamp_minute: minuteStart,
    },
  };

  const actions = [];

  // Base behavior: log an incident for critical anomalies.
  if (severity === 'critical') {
    actions.push(() => logIncident({ userId, anomalyId: anomaly._id, now, metadata }));
  }

  // Sample rule from requirements: critical + high error-rate triggers block.
  if (severity === 'critical' && errorRate > 0.5) {
    actions.push(() => raiseAlert({ userId, anomalyId: anomaly._id, now, metadata }));
    actions.push(() => triggerRateLimitIP({ userId, anomalyId: anomaly._id, ip: topIp, now, metadata }));
    actions.push(() => triggerBlockIP({ userId, anomalyId: anomaly._id, ip: topIp, now, metadata }));
  }

  if (!actions.length) {
    return { executed: false, reason: 'no_rules_matched' };
  }

  const results = [];
  for (const fn of actions) {
    try {
      results.push(await fn());
    } catch (e) {
      logError('action failed', { anomaly_id: String(anomaly._id), message: e?.message });
      results.push({ created: false, failed: true, message: e?.message });
    }
  }

  return { executed: true, results };
}
