import { LogEvent } from '../models/LogEvent.js';
import { Alert } from '../models/Alert.js';
import { Anomaly } from '../models/Anomaly.js';
import { config } from '../config.js';

const WINDOW_MS = 15 * 60_000;
const TICK_MS = 10_000;
const BASELINE_TTL_MS = 60_000;

function logInfo(message, meta) {
  // eslint-disable-next-line no-console
  console.log(`[anomaly-engine] ${message}`, meta ?? '');
}

function logError(message, meta) {
  // eslint-disable-next-line no-console
  console.error(`[anomaly-engine] ${message}`, meta ?? '');
}

function clamp01(x) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function severityFromScore(score) {
  if (score < 0.3) return 'low';
  if (score < 0.6) return 'medium';
  if (score < 0.8) return 'high';
  return 'critical';
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values, mu) {
  if (values.length < 2) return 0;
  const v = values.reduce((acc, x) => acc + (x - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function computeStats(values) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const mu = mean(clean);
  const sigma = std(clean, mu);
  return { mean: mu, std: sigma, n: clean.length };
}

let baselineCache = {
  computedAt: 0,
  stats: null,
};

export async function getMetricsLast15Min({ now = new Date() } = {}) {
  const start = new Date(now.getTime() - WINDOW_MS);

  // Single-pass facet pipeline for all required metrics.
  const [result] = await LogEvent.aggregate([
    { $match: { timestamp: { $gte: start, $lte: now } } },
    {
      $addFields: {
        minute: {
          $dateTrunc: {
            date: '$timestamp',
            unit: 'minute',
          },
        },
      },
    },
    {
      $facet: {
        perMinute: [
          {
            $group: {
              _id: '$minute',
              requests: { $sum: 1 },
              avgLatency: {
                $avg: {
                  $cond: [{ $isNumber: '$attributes.latency' }, '$attributes.latency', null],
                },
              },
              total: { $sum: 1 },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              ips: { $addToSet: '$network.ip' },
            },
          },
          {
            $project: {
              _id: 0,
              minute: '$_id',
              requests: 1,
              avgLatency: 1,
              errorRate: {
                $cond: [{ $gt: ['$total', 0] }, { $divide: ['$failed', '$total'] }, 0],
              },
              uniqueIps: {
                $size: {
                  $setDifference: ['$ips', [null, '']],
                },
              },
            },
          },
          { $sort: { minute: 1 } },
        ],
        perIp: [
          { $match: { 'network.ip': { $exists: true, $ne: null } } },
          { $group: { _id: '$network.ip', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 50 },
          { $project: { _id: 0, ip: '$_id', count: 1 } },
        ],
        overall: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              avgLatency: {
                $avg: {
                  $cond: [{ $isNumber: '$attributes.latency' }, '$attributes.latency', null],
                },
              },
              ips: { $addToSet: '$network.ip' },
            },
          },
          {
            $project: {
              _id: 0,
              total: 1,
              failed: 1,
              avgLatency: 1,
              errorRate: {
                $cond: [{ $gt: ['$total', 0] }, { $divide: ['$failed', '$total'] }, 0],
              },
              uniqueIps: {
                $size: {
                  $setDifference: ['$ips', [null, '']],
                },
              },
            },
          },
        ],
      },
    },
  ]);

  const perMinute = result?.perMinute ?? [];
  const perIp = result?.perIp ?? [];
  const overall = (result?.overall ?? [])[0] ?? { total: 0, failed: 0, avgLatency: null, errorRate: 0, uniqueIps: 0 };

  const currentMinute = perMinute.length ? perMinute[perMinute.length - 1] : null;
  const current = {
    requests_per_minute: Number(currentMinute?.requests ?? 0),
    avg_latency: typeof overall.avgLatency === 'number' ? overall.avgLatency : 0,
    error_rate: Number(overall.errorRate ?? 0),
    unique_ips_count: Number(overall.uniqueIps ?? 0),
    requests_per_ip: perIp,
    requests_per_minute_series: perMinute.map((p) => ({ minute: p.minute, requests: p.requests })),
  };

  const series = {
    requests: perMinute.map((p) => Number(p.requests ?? 0)),
    avgLatency: perMinute.map((p) => (typeof p.avgLatency === 'number' ? p.avgLatency : 0)),
    errorRate: perMinute.map((p) => Number(p.errorRate ?? 0)),
    uniqueIps: perMinute.map((p) => Number(p.uniqueIps ?? 0)),
  };

  return { window: { start, end: now }, current, series };
}

export function detectAnomalyLocal({ current, series }) {
  const epsilon = 1e-6;

  const stats = {
    requests_per_minute: computeStats(series.requests),
    avg_latency: computeStats(series.avgLatency),
    error_rate: computeStats(series.errorRate),
    unique_ips_count: computeStats(series.uniqueIps),
  };

  const checks = [
    { key: 'requests_per_minute', value: current.requests_per_minute, s: stats.requests_per_minute, higherIsWorse: true },
    { key: 'avg_latency', value: current.avg_latency, s: stats.avg_latency, higherIsWorse: true },
    { key: 'error_rate', value: current.error_rate, s: stats.error_rate, higherIsWorse: true },
    { key: 'unique_ips_count', value: current.unique_ips_count, s: stats.unique_ips_count, higherIsWorse: true },
  ];

  let anomaly = false;
  let maxScore = 0;
  const reasons = [];

  for (const c of checks) {
    const z = (c.value - c.s.mean) / (c.s.std + epsilon);
    const zPos = Math.max(0, z);

    // A) Statistical (Z-score): anomaly if > mean + 3*std.
    if (z >= 3 && c.higherIsWorse) {
      anomaly = true;
      reasons.push(`${c.key} z=${Math.round(z * 100) / 100} (value=${Math.round(c.value * 100) / 100}, mean=${Math.round(c.s.mean * 100) / 100})`);
    }

    // B) Simple ML-ish deviation score (simulated): normalize z into 0..1.
    const score = clamp01(zPos / 6);
    if (score > maxScore) maxScore = score;
  }

  const reason = reasons.length ? reasons.join('; ') : 'No z-score threshold exceeded';
  return { anomaly, score: maxScore, reason, stats };
}

export async function callAIEngine({ requests_per_minute, avg_latency, error_rate, unique_ips }) {
  const url = `${config.aiEngineUrl}/detect-anomaly`;
  const body = {
    requests_per_minute,
    avg_latency,
    error_rate,
    unique_ips,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI engine /detect-anomaly failed ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

async function getRepresentativeEventId({ now }) {
  const start = new Date(now.getTime() - WINDOW_MS);
  const doc = await LogEvent.findOne({ timestamp: { $gte: start, $lte: now } }).sort({ timestamp: -1 }).select({ _id: 1 });
  if (doc?._id) return doc._id;
  const anyDoc = await LogEvent.findOne({}).sort({ timestamp: -1 }).select({ _id: 1 });
  return anyDoc?._id ?? null;
}

async function createAnomaly({ score, severity, message, reason, metadata, now = new Date(), alertId = null }) {
  const doc = await Anomaly.create({
    type: 'ANOMALY',
    score,
    severity,
    message,
    reason,
    metadata,
    alert_id: alertId,
    createdAt: now,
  });
  return doc;
}

async function createAiAnomalyAlert({ now, eventId, score, severity, message, reason, metadata, anomalyId }) {
  // Rolling-window dedupe: do not spam the same alert type within 60s.
  const dedupeSince = new Date(now.getTime() - 60_000);
  const groupKey = 'AI_ANOMALY:global';

  const existing = await Alert.findOne({ group_key: groupKey, status: 'open', createdAt: { $gte: dedupeSince } })
    .sort({ createdAt: -1 })
    .select({ _id: 1 });

  if (existing) {
    return null;
  }

  const doc = await Alert.create({
    event_id: eventId,

    type: 'AI_ANOMALY',
    message,
    metadata: { ...metadata, anomaly_id: String(anomalyId), score, reason },

    title: 'AI anomaly detected',
    severity,
    status: 'open',

    threat_type: 'AI_ANOMALY',
    group_key: groupKey,
    reason: reason || message,
    source_ip: metadata?.top_ip ?? undefined,
    actor: 'system',

    event_count: 1,
    first_seen: now,
    last_seen: now,
    window_start: new Date(Math.floor(now.getTime() / 60_000) * 60_000),
    counts: { occurrences: 1, first_seen_at: now, last_seen_at: now },
    createdAt: now,
    updatedAt: now,
  });

  return doc;
}

export async function evaluateAnomalies({ now = new Date() } = {}) {
  const metrics = await getMetricsLast15Min({ now });

  // Empty data safe handling.
  const totalSeriesPoints = metrics.series.requests.length;
  if (!totalSeriesPoints) {
    logInfo('no data in window; skipping');
    return { created: false, reason: 'no_data' };
  }

  // Baseline caching: keep stats for up to 60s.
  let baseline;
  if (baselineCache.stats && now.getTime() - baselineCache.computedAt < BASELINE_TTL_MS) {
    baseline = baselineCache.stats;
  } else {
    baseline = {
      requests: computeStats(metrics.series.requests),
      avgLatency: computeStats(metrics.series.avgLatency),
      errorRate: computeStats(metrics.series.errorRate),
      uniqueIps: computeStats(metrics.series.uniqueIps),
    };
    baselineCache = { computedAt: now.getTime(), stats: baseline };
  }

  const local = detectAnomalyLocal({ current: metrics.current, series: metrics.series });

  let ai = null;
  try {
    ai = await callAIEngine({
      requests_per_minute: metrics.current.requests_per_minute,
      avg_latency: metrics.current.avg_latency,
      error_rate: metrics.current.error_rate,
      unique_ips: metrics.current.unique_ips_count,
    });
  } catch (e) {
    // AI engine outage should not block local detection.
    logError('ai engine call failed', { message: e?.message });
  }

  const aiAnomaly = Boolean(ai?.anomaly);
  const aiScore = typeof ai?.score === 'number' ? ai.score : 0;
  const aiReason = typeof ai?.reason === 'string' ? ai.reason : '';

  const anomaly = local.anomaly || aiAnomaly;
  const score = clamp01(Math.max(local.score ?? 0, aiScore));

  if (!anomaly) {
    logInfo('no anomaly', {
      score: Math.round(score * 1000) / 1000,
      localAnomaly: local.anomaly,
      aiAnomaly,
    });
    return { created: false, score, local, ai };
  }

  const severity = severityFromScore(score);

  const topIp = Array.isArray(metrics.current.requests_per_ip) && metrics.current.requests_per_ip.length
    ? metrics.current.requests_per_ip[0]
    : null;

  const message = `Anomaly detected (score=${Math.round(score * 1000) / 1000}, severity=${severity})`;
  const reason = [
    local.anomaly ? `local: ${local.reason}` : null,
    aiAnomaly ? `ai: ${aiReason || 'anomaly flagged'}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const eventId = await getRepresentativeEventId({ now });
  if (!eventId) {
    logInfo('no log events found; skipping anomaly write');
    return { created: false, score, reason: 'no_event_anchor' };
  }

  // Persist anomaly first.
  const anomalyDoc = await createAnomaly({
    score,
    severity,
    message,
    reason,
    metadata: {
      window: metrics.window,
      current: metrics.current,
      baseline,
      local: { anomaly: local.anomaly, score: local.score, reason: local.reason },
      ai: ai ? { anomaly: aiAnomaly, score: aiScore, reason: aiReason } : { error: 'ai_engine_unavailable' },
      top_ip: topIp?.ip,
    },
    now,
  });

  // Create linked alert.
  const alertDoc = await createAiAnomalyAlert({
    now,
    eventId,
    score,
    severity,
    message,
    reason,
    metadata: { top_ip: topIp?.ip },
    anomalyId: anomalyDoc._id,
  });

  if (alertDoc) {
    await Anomaly.updateOne({ _id: anomalyDoc._id }, { $set: { alert_id: alertDoc._id } });
  }

  logInfo('anomaly stored', {
    anomaly_id: String(anomalyDoc._id),
    alert_id: alertDoc ? String(alertDoc._id) : null,
    score: Math.round(score * 1000) / 1000,
    severity,
  });

  return { created: true, anomaly: anomalyDoc, alert: alertDoc, score, severity };
}

export function startAnomalyEngine({ tickMs = TICK_MS } = {}) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await evaluateAnomalies({ now: new Date() });
    } catch (e) {
      logError('tick failed', { message: e?.message, stack: e?.stack });
    } finally {
      running = false;
    }
  }

  tick().catch(() => undefined);
  const id = setInterval(() => {
    tick().catch(() => undefined);
  }, tickMs);

  logInfo('started', { tickMs, windowMinutes: 15 });

  return {
    stop() {
      clearInterval(id);
      logInfo('stopped');
    },
  };
}
