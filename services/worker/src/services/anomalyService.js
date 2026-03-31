import { MetricsMinute } from '../models/MetricsMinute.js';
import { Anomaly } from '../models/Anomaly.js';
import { Alert } from '../models/Alert.js';
import { LogEvent } from '../models/LogEvent.js';
import { config } from '../config.js';
import { getBaseline, setBaseline, BASELINE_KEYS } from './baselineService.js';
import { safeRedisGet, safeRedisSet } from '../redisClient.js';
import { handleAutoResponse } from './autoResponseService.js';

const ONE_MINUTE_MS = 60_000;
const WINDOW_MINUTES = 15;
const TICK_MS = 10_000;

function baselineKeyForUser(baseKey, userId) {
  return `${String(baseKey)}:${String(userId)}`;
}

async function getActiveUserIds({ now = new Date() } = {}) {
  const since = new Date(now.getTime() - WINDOW_MINUTES * 2 * ONE_MINUTE_MS);
  const userIds = await LogEvent.distinct('user_id', {
    user_id: { $exists: true, $type: 'string', $ne: '' },
    timestamp: { $gte: since },
  }).catch(() => []);

  return (Array.isArray(userIds) ? userIds : []).map((x) => String(x)).filter(Boolean);
}

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

function dynamicZThreshold(n) {
  // Early baseline (just enough points) should be stricter to avoid false positives.
  // As the baseline matures, relax toward the standard 3-sigma rule.
  const nn = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (nn <= 10) return 4.0;
  if (nn >= 60) return 3.0;
  const t = (nn - 10) / 50; // 0..1
  return 4.0 - t * 1.0;
}

function dynamicScoreThreshold(n) {
  // Per requirements:
  // - early window -> 0.75
  // - stable window -> 0.6
  // Interpret "early" as a baseline under 30 points.
  const nn = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return nn < 30 ? 0.75 : 0.6;
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

function zScore(x, mu, sigma) {
  const eps = 1e-6;
  return (x - mu) / (sigma + eps);
}

export async function getMetricsLast15Min({ userId, now = new Date() } = {}) {
  const uid = String(userId ?? '').trim();
  if (!uid) return { window: { end: now, minutes: WINDOW_MINUTES, from_metrics_minute: true }, current: {}, series: {}, docsCount: 0 };

  // Prefer Redis cached last_metrics for the current minute values (TTL 60s)
  const cached = await safeRedisGet(`anomaly:last_metrics:${uid}`);
  const cachedDoc = cached ? (() => {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  })() : null;

  const last15 = await MetricsMinute.find({ user_id: uid })
    .sort({ timestamp_minute: -1 })
    .limit(WINDOW_MINUTES)
    .select({ timestamp_minute: 1, requests: 1, avg_latency: 1, error_rate: 1, unique_ips: 1 })
    .lean();

  const docs = Array.isArray(last15) ? last15.slice().reverse() : [];

  const series = {
    requests_per_minute: docs.map((d) => Number(d.requests ?? 0)),
    avg_latency: docs.map((d) => Number(d.avg_latency ?? 0)),
    error_rate: docs.map((d) => Number(d.error_rate ?? 0)),
    unique_ips: docs.map((d) => Number(d.unique_ips ?? 0)),
  };

  const currentDoc = cachedDoc && cachedDoc.timestamp_minute ? cachedDoc : docs.length ? docs[docs.length - 1] : null;

  const currentTimestampMinute = currentDoc?.timestamp_minute
    ? (() => {
        const d = new Date(currentDoc.timestamp_minute);
        return Number.isNaN(d.getTime()) ? null : d;
      })()
    : null;

  const current = {
    timestamp_minute: currentTimestampMinute,
    requests_per_minute: Number(currentDoc?.requests ?? 0),
    avg_latency: Number(currentDoc?.avg_latency ?? 0),
    error_rate: Number(currentDoc?.error_rate ?? 0),
    unique_ips: Number(currentDoc?.unique_ips ?? 0),
  };

  const window = {
    end: now,
    minutes: WINDOW_MINUTES,
    from_metrics_minute: true,
  };

  // Cache the full computed metrics for 60s.
  await safeRedisSet(`anomaly:cached:metrics15m:${uid}`, JSON.stringify({ window, current, series, docsCount: docs.length }), {
    ttlSeconds: 60,
  });

  return { window, current, series, docsCount: docs.length };
}

export function detectAnomalyLocal({ current, baseline }) {
  const baselineN = Math.min(
    Number(baseline?.requests?.n ?? 0),
    Number(baseline?.latency?.n ?? 0),
    Number(baseline?.error_rate?.n ?? 0),
    Number(baseline?.unique_ips?.n ?? 0)
  );
  const thresholdZ = dynamicZThreshold(baselineN);

  const checks = [
    { key: 'requests_per_minute', value: current.requests_per_minute, b: baseline.requests, higherIsWorse: true },
    { key: 'avg_latency', value: current.avg_latency, b: baseline.latency, higherIsWorse: true },
    { key: 'error_rate', value: current.error_rate, b: baseline.error_rate, higherIsWorse: true },
    { key: 'unique_ips', value: current.unique_ips, b: baseline.unique_ips, higherIsWorse: true },
  ];

  let anomaly = false;
  let maxScore = 0;
  const reasons = [];
  let maxZ = 0;

  for (const c of checks) {
    const z = zScore(c.value, c.b.mean, c.b.std);
    const zPos = Math.max(0, z);

    if (zPos > maxZ) maxZ = zPos;

    // Statistical rule: dynamic z-score threshold (early stricter, later relaxed)
    if (c.higherIsWorse && z >= thresholdZ) {
      anomaly = true;
      reasons.push(
        `${c.key} z=${Math.round(z * 100) / 100} (thr=${Math.round(thresholdZ * 100) / 100}, x=${Math.round(c.value * 100) / 100}, mean=${Math.round(c.b.mean * 100) / 100})`
      );
    }

    // Deviation score normalized by the current threshold.
    const score = clamp01(zPos / Math.max(1e-6, thresholdZ * 2));
    if (score > maxScore) maxScore = score;
  }

  const baselineStrength = clamp01((baselineN - 10) / 50);
  const confidence = clamp01(0.25 + 0.75 * maxScore * (0.6 + 0.4 * baselineStrength));

  return {
    anomaly,
    score: maxScore,
    confidence,
    score_threshold: dynamicScoreThreshold(baselineN),
    threshold_z: thresholdZ,
    baseline_n: baselineN,
    max_z: maxZ,
    reason: reasons.length ? reasons.join('; ') : 'No z-score threshold exceeded',
  };
}

export async function callAIEngine({ requests_per_minute, avg_latency, error_rate, unique_ips }) {
  const base = String(config.aiEngineUrl || '').replace(/\/$/, '');
  const url = `${base}/detect-anomaly`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(250, Number(config.aiEngineTimeoutMs ?? 4500)));
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ requests_per_minute, avg_latency, error_rate, unique_ips }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI engine /detect-anomaly failed ${res.status}: ${text.slice(0, 500)}`);
    }

    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getRepresentativeEventId({ now, userId }) {
  // Cheap anchor: most recent log event.
  const uid = String(userId ?? '').trim();
  if (!uid) return null;
  const doc = await LogEvent.findOne({ user_id: uid }).sort({ timestamp: -1 }).select({ _id: 1 });
  return doc?._id ?? null;
}

async function shouldDedupeAnomaly({ userId, type, timestamp_minute }) {
  if (!timestamp_minute) return { dedupe: false };
  const uid = String(userId ?? '').trim();
  if (!uid) return { dedupe: false };
  const existing = await Anomaly.findOne({ user_id: uid, type, timestamp_minute })
    .sort({ createdAt: -1 })
    .select({ _id: 1, timestamp_minute: 1, createdAt: 1 })
    .lean();

  return existing ? { dedupe: true, existing } : { dedupe: false };
}

export async function createAnomaly({ userId, type = 'ANOMALY', timestamp_minute, score, severity, message, reason, metadata, now = new Date() }) {
  const uid = String(userId ?? '').trim();
  if (!uid) throw new Error('createAnomaly requires userId');

  const dedupeCheck = await shouldDedupeAnomaly({ userId: uid, type, timestamp_minute });
  if (dedupeCheck.dedupe) {
    logInfo('anomaly skipped (dedupe)', {
      user_id: uid,
      type,
      timestamp_minute: timestamp_minute?.toISOString?.(),
      existing_id: String(dedupeCheck.existing._id),
    });
    return { created: false, deduped: true, anomaly: null };
  }

  const confidence = typeof metadata?.confidence === 'number' ? metadata.confidence : null;

  const doc = await Anomaly.create({
    user_id: uid,
    type,
    timestamp_minute,
    score,
    confidence,
    severity,
    message,
    reason,
    metadata,
    createdAt: now,
  });

  logInfo('anomaly created', { anomaly_id: String(doc._id), type, severity, score: Math.round(score * 1000) / 1000 });
  return { created: true, deduped: false, anomaly: doc };
}

async function createAiAnomalyAlert({ userId, now, eventId, timestamp_minute, score, severity, message, reason, anomalyId }) {
  // Dedupe alerts separately (avoid spamming dashboards)
  const uid = String(userId ?? '').trim();
  if (!uid) return null;
  const since = new Date(now.getTime() - ONE_MINUTE_MS);
  const groupKey = 'AI_ANOMALY:global';
  const existing = await Alert.findOne({ user_id: uid, group_key: groupKey, status: 'open', createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .select({ _id: 1 })
    .lean();
  if (existing) return null;

  return Alert.create({
    user_id: uid,
    event_id: eventId,

    timestamp_minute: timestamp_minute ?? null,

    type: 'AI_ANOMALY',
    message,
    metadata: { anomaly_id: String(anomalyId), score, reason },

    title: 'AI anomaly detected',
    severity,
    status: 'open',

    threat_type: 'AI_ANOMALY',
    group_key: groupKey,
    reason: reason || message,
    actor: 'system',

    event_count: 1,
    first_seen: now,
    last_seen: now,
    window_start: new Date(Math.floor(now.getTime() / ONE_MINUTE_MS) * ONE_MINUTE_MS),
    counts: { occurrences: 1, first_seen_at: now, last_seen_at: now },
    createdAt: now,
    updatedAt: now,
  });
}

async function computeAndPersistBaselines({ userId, series, now }) {
  const uid = String(userId ?? '').trim();
  if (!uid) throw new Error('computeAndPersistBaselines requires userId');
  const requestsStats = computeStats(series.requests_per_minute);
  const latencyStats = computeStats(series.avg_latency);
  const errorRateStats = computeStats(series.error_rate);
  const uniqueIpsStats = computeStats(series.unique_ips);

  // Persist under required keys (plus unique_ips for completeness)
  await setBaseline(baselineKeyForUser(BASELINE_KEYS.requests, uid), { mean: requestsStats.mean, std: requestsStats.std, n: requestsStats.n, last_updated: now });
  await setBaseline(baselineKeyForUser(BASELINE_KEYS.latency, uid), { mean: latencyStats.mean, std: latencyStats.std, n: latencyStats.n, last_updated: now });
  await setBaseline(baselineKeyForUser(BASELINE_KEYS.error_rate, uid), { mean: errorRateStats.mean, std: errorRateStats.std, n: errorRateStats.n, last_updated: now });
  await setBaseline(baselineKeyForUser(BASELINE_KEYS.unique_ips, uid), { mean: uniqueIpsStats.mean, std: uniqueIpsStats.std, n: uniqueIpsStats.n, last_updated: now });

  return {
    requests: requestsStats,
    latency: latencyStats,
    error_rate: errorRateStats,
    unique_ips: uniqueIpsStats,
  };
}

async function loadBaselinesOrCompute({ userId, series, now }) {
  const uid = String(userId ?? '').trim();
  if (!uid) throw new Error('loadBaselinesOrCompute requires userId');
  const [req, lat, err, ips] = await Promise.all([
    getBaseline(baselineKeyForUser(BASELINE_KEYS.requests, uid)),
    getBaseline(baselineKeyForUser(BASELINE_KEYS.latency, uid)),
    getBaseline(baselineKeyForUser(BASELINE_KEYS.error_rate, uid)),
    getBaseline(baselineKeyForUser(BASELINE_KEYS.unique_ips, uid)),
  ]);

  if (req && lat && err && ips) {
    return {
      requests: { mean: req.mean, std: req.std, n: typeof req.n === 'number' ? req.n : null },
      latency: { mean: lat.mean, std: lat.std, n: typeof lat.n === 'number' ? lat.n : null },
      error_rate: { mean: err.mean, std: err.std, n: typeof err.n === 'number' ? err.n : null },
      unique_ips: { mean: ips.mean, std: ips.std, n: typeof ips.n === 'number' ? ips.n : null },
      source: `persisted(${req.source}/${lat.source}/${err.source}/${ips.source})`,
    };
  }

  const computed = await computeAndPersistBaselines({ userId: uid, series, now });
  return { ...computed, source: 'computed' };
}

let anomaliesCreatedCount = 0;

export async function evaluateAnomalies({ now = new Date() } = {}) {
  const userIds = await getActiveUserIds({ now });
  if (!userIds.length) {
    logInfo('skipping (no active tenants found)', {});
    return { created: false, reason: 'no_active_tenants' };
  }

  const results = [];
  for (const userId of userIds) {
    const t0 = Date.now();

    // eslint-disable-next-line no-await-in-loop
    const metrics = await getMetricsLast15Min({ userId, now });
    if (metrics.docsCount < Number(config.minMetricsHistoryForAnomaly ?? 10)) {
      logInfo('skipping (insufficient metrics_minute history)', { user_id: userId, docsCount: metrics.docsCount });
      results.push({ user_id: userId, created: false, reason: 'insufficient_history' });
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const baseline = await loadBaselinesOrCompute({ userId, series: metrics.series, now });
    const local = detectAnomalyLocal({ current: metrics.current, baseline });

    const metricsMinute = metrics?.current?.timestamp_minute;
    const timestampMinute = metricsMinute && typeof metricsMinute.getTime === 'function' && !Number.isNaN(metricsMinute.getTime())
      ? metricsMinute
      : null;

    if (!timestampMinute) {
      logInfo('skipping (missing timestamp_minute from metrics_minute)', {
        user_id: userId,
        docsCount: metrics.docsCount,
        current_timestamp_minute: metrics?.current?.timestamp_minute ?? null,
      });
      results.push({ user_id: userId, created: false, reason: 'missing_timestamp_minute' });
      // eslint-disable-next-line no-continue
      continue;
    }

    let ai = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      ai = await callAIEngine({
        requests_per_minute: metrics.current.requests_per_minute,
        avg_latency: metrics.current.avg_latency,
        error_rate: metrics.current.error_rate,
        unique_ips: metrics.current.unique_ips,
      });
      logInfo('ai response', { user_id: userId, anomaly: Boolean(ai?.anomaly), score: ai?.score, reason: ai?.reason });
    } catch (e) {
      logError('ai engine failed; falling back to local', { user_id: userId, message: e?.message });
    }

    const aiAnomaly = Boolean(ai?.anomaly);
    const aiScore = typeof ai?.score === 'number' ? ai.score : 0;

    const scoreThreshold = typeof local?.score_threshold === 'number' ? local.score_threshold : dynamicScoreThreshold(local?.baseline_n ?? 0);
    const score = clamp01(Math.max(local.score ?? 0, aiScore));
    const confidence = clamp01(Math.max(local.confidence ?? 0, aiAnomaly ? aiScore : 0));
    const isAnomaly = local.anomaly || (aiAnomaly && aiScore >= scoreThreshold) || (score >= scoreThreshold);

    const detectionTimeMs = Date.now() - t0;

    if (!isAnomaly) {
      logInfo('no anomaly', { user_id: userId, score: Math.round(score * 1000) / 1000, score_threshold: scoreThreshold, detection_time_ms: detectionTimeMs });
      results.push({ user_id: userId, created: false, score, detection_time_ms: detectionTimeMs });
      // eslint-disable-next-line no-continue
      continue;
    }

    const severity = severityFromScore(score);
    const message = `Anomaly detected (score=${Math.round(score * 1000) / 1000}, severity=${severity})`;
    const reason = [
      local.anomaly ? `local: ${local.reason}` : null,
      aiAnomaly ? `ai: ${String(ai?.reason ?? 'anomaly flagged')}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    // eslint-disable-next-line no-await-in-loop
    const anomalyRes = await createAnomaly({
      userId,
      type: 'ANOMALY',
      timestamp_minute: timestampMinute,
      score,
      severity,
      message,
      reason,
      metadata: {
        confidence,
        window: metrics.window,
        current: metrics.current,
        baseline: {
          source: baseline.source,
          requests: baseline.requests,
          latency: baseline.latency,
          error_rate: baseline.error_rate,
          unique_ips: baseline.unique_ips,
        },
        local,
        ai,
        detection_time_ms: detectionTimeMs,
      },
      now,
    });

    if (!anomalyRes.created || !anomalyRes.anomaly) {
      results.push({ user_id: userId, created: false, deduped: true, detection_time_ms: detectionTimeMs });
      // eslint-disable-next-line no-continue
      continue;
    }

    // Auto-response is best-effort and must never block anomaly creation.
    try {
      // eslint-disable-next-line no-await-in-loop
      await handleAutoResponse(anomalyRes.anomaly, metrics.current, { now });
    } catch (e) {
      logError('auto-response failed (non-fatal)', { user_id: userId, message: e?.message });
    }

    anomaliesCreatedCount += 1;

    // eslint-disable-next-line no-await-in-loop
    const eventId = await getRepresentativeEventId({ now, userId });
    if (!eventId) {
      logInfo('no log event anchor for alert; anomaly stored only', { user_id: userId, anomaly_id: String(anomalyRes.anomaly._id) });
      results.push({ user_id: userId, created: true, anomaly_id: String(anomalyRes.anomaly._id), alert_id: null, detection_time_ms: detectionTimeMs });
      // eslint-disable-next-line no-continue
      continue;
    }

    let alertDoc = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      alertDoc = await createAiAnomalyAlert({
        userId,
        now,
        eventId,
        timestamp_minute: timestampMinute,
        score,
        severity,
        message,
        reason,
        anomalyId: anomalyRes.anomaly._id,
      });

      if (alertDoc) {
        // eslint-disable-next-line no-await-in-loop
        await Anomaly.updateOne({ _id: anomalyRes.anomaly._id }, { $set: { alert_id: alertDoc._id } });
      }
    } catch (e) {
      logError('alert creation failed (non-fatal)', { user_id: userId, message: e?.message });
    }

    logInfo('anomaly detected', {
      user_id: userId,
      anomaly_id: String(anomalyRes.anomaly._id),
      alert_id: alertDoc ? String(alertDoc._id) : null,
      timestamp_minute: timestampMinute.toISOString(),
      severity,
      score: Math.round(score * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      baseline_n: local.baseline_n ?? null,
      threshold_z: local.threshold_z ?? null,
      detection_time_ms: detectionTimeMs,
      anomalies_created_count: anomaliesCreatedCount,
    });

    results.push({
      user_id: userId,
      created: true,
      anomaly_id: String(anomalyRes.anomaly._id),
      alert_id: alertDoc ? String(alertDoc._id) : null,
      detection_time_ms: detectionTimeMs,
    });
  }

  return {
    created: results.some((r) => r && r.created),
    results,
  };
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

  // run soon, then every 10 seconds
  setTimeout(() => tick().catch(() => undefined), 3_000);
  const id = setInterval(() => {
    tick().catch(() => undefined);
  }, tickMs);

  logInfo('started', { tickMs, windowMinutes: WINDOW_MINUTES });

  return {
    stop() {
      clearInterval(id);
      logInfo('stopped');
    },
  };
}
