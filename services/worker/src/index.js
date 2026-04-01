import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import Redis from 'ioredis';
import mongoose from 'mongoose';

import { requireEnv, config } from './config.js';
import { connectMongo } from './db.js';
import { LogEvent } from './models/LogEvent.js';
import { MetricsMinute } from './models/MetricsMinute.js';
import { Anomaly } from './models/Anomaly.js';
import { AnomalyResult } from './models/AnomalyResult.js';
import { Alert } from './models/Alert.js';
import { Incident } from './models/Incident.js';
import { Response } from './models/Response.js';
import { lookupThreatIntel } from './lib/threatIntel.js';
import { startAlertEngine } from './lib/alertService.js';
import { startAnomalyEngine } from './services/anomalyService.js';
import { startMetricsMinuteJob } from './services/metricsService.js';
import { logger } from './lib/logger.js';

requireEnv();
await connectMongo();

await Promise.allSettled([
  LogEvent.syncIndexes(),
  MetricsMinute.syncIndexes(),
  Anomaly.syncIndexes(),
  Alert.syncIndexes(),
  Incident.syncIndexes(),
  Response.syncIndexes(),
  AnomalyResult.syncIndexes(),
]);

const log = logger;

let aiFailures = 0;
const MAX_AI_FAILURES = 5;

const ONE_MINUTE_MS = 60_000;

function floorToUtcMinute(date) {
  const d = date instanceof Date ? date : new Date(date);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(Math.floor(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

// BullMQ should use Redis URL directly (single source of truth).
const bullConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
  enableOfflineQueue: false,
  connectTimeout: 5000,
});

bullConnection.on("error", (err) => {
  log.error({ err }, "redis_error_runtime");
});

bullConnection.on("end", () => {
  log.error("❌ Redis connection closed");
  process.exit(1);
});

try {
  const pong = await bullConnection.ping();
  if (pong !== 'PONG') {
    throw new Error('bad_pong');
  }
} catch (e) {
  log.error({ err: e }, 'redis_unavailable');
  process.exit(1);
}

async function broadcastAlertCreated(alertDoc) {
  if (!alertDoc) return;

  const url = `${config.backendApiUrl}/internal/broadcast/alert`;
  const payload = typeof alertDoc.toJSON === 'function' ? alertDoc.toJSON() : alertDoc;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': config.internalBroadcastSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log.warn({ status: res.status, body: text.slice(0, 500) }, 'broadcast failed');
    }
  } catch (e) {
    log.warn({ err: e }, 'broadcast error');
  }
}

function deriveGroupKey({ threatType, sourceIp, actor, timestamp }) {
  const ip = sourceIp || 'unknown_ip';
  const who = actor || 'unknown_actor';
  return `${threatType}:${ip}:${who}`;
}

function computeWindowStart(date, windowMs) {
  const t = date.getTime();
  return new Date(Math.floor(t / windowMs) * windowMs);
}

function titleForThreat(threatType) {
  switch (threatType) {
    case 'brute_force_login':
      return 'Possible brute force login attempt';
    case 'suspicious_api_traffic':
      return 'Suspicious API traffic';
    case 'privilege_escalation':
      return 'Possible privilege escalation';
    case 'exfiltration':
      return 'Possible data exfiltration';
    default:
      return 'Suspicious activity detected';
  }
}

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

function severityIndex(severity) {
  const i = SEVERITY_ORDER.indexOf(severity);
  return i === -1 ? 0 : i;
}

function maxSeverity(a, b) {
  return severityIndex(a) >= severityIndex(b) ? a : b;
}

async function correlateIncidentFromAlert(alertDoc) {
  if (!alertDoc) return;

  const userId = alertDoc.user_id ? String(alertDoc.user_id) : null;

  const actor = alertDoc.actor || 'unknown_actor';
  const sourceIp = alertDoc.source_ip || 'unknown_ip';

  const now = new Date();
  const firstSeen = alertDoc.first_seen ?? now;
  const lastSeen = alertDoc.last_seen ?? now;

  const filter = {
    ...(userId ? { user_id: userId } : {}),
    status: { $ne: 'resolved' },
    // Use $in so upsert does not accidentally insert scalar values into array fields.
    actors: { $in: [actor] },
    source_ips: { $in: [sourceIp] },
  };

  const update = {
    $addToSet: {
      alerts: alertDoc._id,
    },
    $set: {
      last_seen: lastSeen,
      updatedAt: now,
    },
    $setOnInsert: {
      ...(userId ? { user_id: userId } : {}),
      title: alertDoc.title,
      severity: alertDoc.severity,
      status: 'open',
      first_seen: firstSeen,
      actors: [actor],
      source_ips: [sourceIp],
      createdAt: now,
    },
  };

  const incident = await Incident.findOneAndUpdate(filter, update, { new: true, upsert: true });

  if (incident && severityIndex(alertDoc.severity) > severityIndex(incident.severity)) {
    await Incident.updateOne({ _id: incident._id }, { $set: { severity: alertDoc.severity, updatedAt: now } });
  }
}

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`ai_invalid_response:${name}`);
  }
}

function assertFiniteNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`ai_invalid_response:${name}`);
  }
  return n;
}

async function callAiEngine(normalizedEvent) {
  const base = String(config.aiEngineUrl || '').replace(/\/$/, '');
  const timeoutMs = Math.max(250, Number(config.aiEngineTimeoutMs ?? 8000));

  if (aiFailures >= MAX_AI_FAILURES) {
    throw new Error("AI temporarily disabled due to repeated failures");
  }

  try {
    const res = await axios.post(
      `${base}/analyze`,
      { event: normalizedEvent },
      {
        timeout: timeoutMs,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        validateStatus: () => true,
      }
    );

    if (res.status < 200 || res.status >= 300) {
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null);
      throw new Error(`AI engine error ${res.status}: ${String(body).slice(0, 500)}`);
    }

    const analyzed = res.data;

    if (!analyzed || typeof analyzed !== 'object') {
      throw new Error('ai_invalid_response:body');
    }

    assertNonEmptyString(analyzed.model_version, 'model_version');
    assertNonEmptyString(analyzed.threat_type, 'threat_type');
    assertNonEmptyString(analyzed.risk_level, 'risk_level');

    analyzed.risk_score = assertFiniteNumber(analyzed.risk_score, 'risk_score');
    analyzed.anomaly_score = assertFiniteNumber(analyzed.anomaly_score, 'anomaly_score');

    aiFailures = 0; // reset on success

    return analyzed;

  } catch (e) {
    aiFailures++;

    log.warn({
      aiFailures,
      err: e,
    }, "ai_engine_failure");

    if (axios.isAxiosError(e) && e.code === 'ECONNABORTED') {
      throw new Error(`AI engine timeout after ${timeoutMs}ms`);
    }

    throw e;
  }
}

const analysisQueue = new Queue('analysis-jobs', {
  connection: bullConnection,
});

const worker = new Worker(
  'analysis-jobs',
  async (job) => {
    const { event_id } = job.data;
    log.info({ job_id: job.id, event_id, name: job.name }, 'job received');
    const eventDoc = await LogEvent.findById(event_id);
    if (!eventDoc) {
      log.info({ job_id: job.id, event_id }, 'event not found; skipping');
      return;
    }

    const normalizedEvent = {
      timestamp: eventDoc.timestamp.toISOString(),
      source: eventDoc.source,
      event_type: eventDoc.event_type,
      message: eventDoc.message,
      status: eventDoc.status,
      severity_hint: eventDoc.severity_hint,
      tenant_id: eventDoc.tenant_id,
      ingest_id: eventDoc.ingest_id,
      actor: eventDoc.actor ?? undefined,
      network: eventDoc.network ?? undefined,
      attributes: eventDoc.attributes ?? {},
      tags: eventDoc.tags ?? [],
    };

    try {
      const analyzed = await callAiEngine(normalizedEvent);

      log.info({
        job_id: job.id,
        event_id,
        threat_type: analyzed.threat_type,
        risk_score: analyzed.risk_score,
        risk_level: analyzed.risk_level,
      }, 'ai analysis completed');

      const anomalyResultKey = {
        user_id: eventDoc.user_id ? String(eventDoc.user_id) : null,
        event_id: eventDoc._id,
      };

      await AnomalyResult.updateOne(
        anomalyResultKey,
        {
          $set: {
            timestamp_minute: eventDoc.timestamp ? floorToUtcMinute(eventDoc.timestamp) : null,
            model_version: analyzed.model_version,
            anomaly_score: analyzed.anomaly_score,
            risk_score: analyzed.risk_score,
            risk_level: analyzed.risk_level,
            threat_type: analyzed.threat_type,
            explanations: analyzed.explanations ?? [],
            features: analyzed.features ?? undefined,
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      if (Number(analyzed.risk_score) < config.alertThresholdRisk) {
        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'done' });
        log.info({
          job_id: job.id,
          event_id,
          risk_score: analyzed.risk_score,
          threshold: config.alertThresholdRisk,
        }, 'risk below threshold; no alert');
        return;
      }

      const sourceIp = eventDoc.network?.ip;
      const actor = eventDoc.actor?.user ?? eventDoc.actor?.service;
      const userId = eventDoc.user_id ? String(eventDoc.user_id) : null;

      const threatIntel = sourceIp ? await lookupThreatIntel(sourceIp) : null;
      const groupKey = deriveGroupKey({
        threatType: analyzed.threat_type,
        sourceIp,
        actor,
        timestamp: eventDoc.timestamp,
      });

      const title = titleForThreat(analyzed.threat_type);
      const reason = (analyzed.explanations ?? []).slice(0, 3).join('; ') || 'Risk score exceeded threshold';

      const now = new Date();

      const windowMs = 5 * 60_000;
      const windowStart = computeWindowStart(eventDoc.timestamp ?? now, windowMs);

      // IMPORTANT: Avoid Mongo ConflictingUpdateOperators.
      // Do not set `counts` object AND `counts.*` subfields in same update.
      // Do not update the same `counts.*` path in multiple operators.
      const update = {
        $inc: {
          event_count: 1,
          'counts.occurrences': 1,
        },
        $set: {
          last_seen: now,
          'counts.last_seen_at': now,
          updatedAt: now,
          ...(threatIntel ? { threat_intel: threatIntel } : {}),
        },
        $setOnInsert: {
          ...(userId ? { user_id: userId } : {}),
          event_id: eventDoc._id,
          title,
          severity: analyzed.risk_level,
          status: 'open',
          threat_type: analyzed.threat_type,
          group_key: groupKey,
          reason,
          source_ip: sourceIp,
          actor,
          first_seen: now,
          'counts.first_seen_at': now,
          createdAt: now,
          window_start: windowStart,
        },
      };

      let alert;
      try {
        alert = await Alert.findOneAndUpdate(
          { ...(userId ? { user_id: userId } : {}), group_key: groupKey, status: 'open', window_start: windowStart },
          update,
          { new: true, upsert: true }
        );
      } catch (e) {
        // If two workers attempt insert concurrently, unique index may throw; retry as update.
        if (e && e.code === 11000) {
          alert = await Alert.findOneAndUpdate(
            { ...(userId ? { user_id: userId } : {}), group_key: groupKey, status: 'open', window_start: windowStart },
            {
              $inc: { event_count: 1, 'counts.occurrences': 1 },
              $set: { last_seen: now, 'counts.last_seen_at': now, updatedAt: now, ...(threatIntel ? { threat_intel: threatIntel } : {}) },
            },
            { new: true }
          );
        } else if (e && String(e.message || '').includes('ConflictingUpdateOperators')) {
          // Defensive fallback: do a minimal update that avoids any nested structure conflicts.
          log.warn({ job_id: job.id, event_id, err: e }, 'mongo update conflict; retrying with minimal update');
          alert = await Alert.findOneAndUpdate(
            { ...(userId ? { user_id: userId } : {}), group_key: groupKey, status: 'open', window_start: windowStart },
            {
              $inc: { event_count: 1, 'counts.occurrences': 1 },
              $set: { last_seen: now, updatedAt: now, ...(threatIntel ? { threat_intel: threatIntel } : {}) },
              $setOnInsert: {
                ...(userId ? { user_id: userId } : {}),
                event_id: eventDoc._id,
                title,
                severity: analyzed.risk_level,
                status: 'open',
                threat_type: analyzed.threat_type,
                group_key: groupKey,
                reason,
                source_ip: sourceIp,
                actor,
                first_seen: now,
                createdAt: now,
                window_start: windowStart,
              },
            },
            { new: true, upsert: true }
          );
        } else {
          throw e;
        }
      }

      // Escalate severity if needed (keep monotonic).
      if (alert) {
        log.info({
          job_id: job.id,
          event_id,
          alert_id: String(alert._id),
          group_key: alert.group_key,
          window_start: alert.window_start,
          event_count: alert.event_count,
          severity: alert.severity,
          threat_type: alert.threat_type,
        }, 'alert upserted');

        await broadcastAlertCreated(alert);

        const effectiveSeverity = maxSeverity(alert.severity, analyzed.risk_level);
        if (effectiveSeverity !== alert.severity) {
          await Alert.updateOne({ _id: alert._id }, { $set: { severity: effectiveSeverity } });
          alert.severity = effectiveSeverity;
        }

        try {
          await correlateIncidentFromAlert(alert);
          log.info({
            job_id: job.id,
            event_id,
            alert_id: String(alert._id),
            actor: alert.actor,
            source_ip: alert.source_ip,
          }, 'incident correlated');
        } catch (e) {
          // Incident correlation should never fail the job.
          log.warn({ job_id: job.id, event_id, alert_id: String(alert._id), err: e }, 'incident correlation failed');
        }

        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'done' });
      } else {
        log.error({ job_id: job.id, event_id }, 'alert upsert returned null');
        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'error' });
      }
    } catch (e) {
      await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'error' });
      log.error({ job_id: job.id, event_id, err: e }, 'job failed');
      throw e;
    }
  },
  {
    connection: bullConnection,
    concurrency: 10,
  }
);

worker.on('completed', (job) => {
  log.info({ job_id: job?.id, name: job?.name }, 'job completed');
});

worker.on('failed', (job, err) => {
  log.error({ job_id: job?.id, name: job?.name, err }, 'job failed (event)');
});

worker.on('error', (err) => {
  log.error({ err }, 'worker error');
});

worker.on('stalled', (jobId) => {
  log.warn({ job_id: jobId }, 'job stalled');
});

log.info({ concurrency: 10 }, 'worker started');

async function heartbeat() {
  try {
    const mongoReadyState = mongoose.connection.readyState;
    const client = await worker.client;
    const pong = await client.ping();

    if (pong !== 'PONG') {
      throw new Error('redis_unhealthy');
    }

    const counts = await analysisQueue.getJobCounts('waiting', 'active', 'failed', 'delayed');

    log.info(
      {
        mongoReadyState,
        redis: pong === 'PONG' ? 'ok' : 'down',
        queue: counts,
        mem: process.memoryUsage(),
      },
      'worker_heartbeat'
    );
  } catch (e) {
    log.warn({ err: e }, 'worker_heartbeat_failed');
  }
}

const heartbeatTimer = setInterval(() => {
  void heartbeat();
}, config.heartbeatIntervalMs);
heartbeatTimer.unref?.();

async function shutdown(signal) {
  log.info({ signal }, 'shutdown_start');

  try {
    clearInterval(heartbeatTimer);

    await Promise.allSettled([
      worker.close(),
      analysisQueue.close(),
      bullConnection.quit(),
    ]);

    log.info('shutdown_complete');

  } catch (e) {
    log.error({ err: e }, 'shutdown_error');
  }

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Rule-based intelligent alerts (runs on a timer, independent of job processing)
startAlertEngine({ tickMs: 10_000 });

// Log metrics aggregation (runs every 60s; writes to metrics_minute)
startMetricsMinuteJob({ tickMs: 60_000 });

// AI-based anomaly detection (runs every 10s; reads last 15 metrics_minute docs)
startAnomalyEngine({ tickMs: 10_000 });
