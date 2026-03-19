import { Worker } from 'bullmq';

import { requireEnv, config } from './config.js';
import { connectMongo } from './db.js';
import { LogEvent } from './models/LogEvent.js';
import { AnomalyResult } from './models/AnomalyResult.js';
import { Alert } from './models/Alert.js';
import { Incident } from './models/Incident.js';
import { redisConnectionFromUrl } from './redis.js';
import { lookupThreatIntel } from './lib/threatIntel.js';
import { startAlertEngine } from './lib/alertService.js';

requireEnv();
await connectMongo();

function logInfo(message, meta) {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${message}`, meta ?? '');
}

function logError(message, meta) {
  // eslint-disable-next-line no-console
  console.error(`[worker] ${message}`, meta ?? '');
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
        ...(config.internalBroadcastSecret ? { 'x-internal-secret': config.internalBroadcastSecret } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logError('broadcast failed', { status: res.status, body: text.slice(0, 500) });
    }
  } catch (e) {
    logError('broadcast error', { message: e?.message });
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

  const actor = alertDoc.actor || 'unknown_actor';
  const sourceIp = alertDoc.source_ip || 'unknown_ip';

  const now = new Date();
  const firstSeen = alertDoc.first_seen ?? now;
  const lastSeen = alertDoc.last_seen ?? now;

  const filter = {
    status: { $ne: 'resolved' },
    // NOTE: Equality on array fields matches when the array contains the value.
    // It also ensures the upsert has concrete values for these fields.
    actors: actor,
    source_ips: sourceIp,
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

async function callAiEngine(normalizedEvent) {
  const res = await fetch(`${config.aiEngineUrl}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: normalizedEvent }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI engine error ${res.status}: ${text}`);
  }
  return res.json();
}

const worker = new Worker(
  'analysis-jobs',
  async (job) => {
    const { event_id } = job.data;
    logInfo('job received', { job_id: job.id, event_id });
    const eventDoc = await LogEvent.findById(event_id);
    if (!eventDoc) {
      logInfo('event not found; skipping', { job_id: job.id, event_id });
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

      logInfo('ai analysis completed', {
        job_id: job.id,
        event_id,
        threat_type: analyzed.threat_type,
        risk_score: analyzed.risk_score,
        risk_level: analyzed.risk_level,
      });

      await AnomalyResult.create({
        event_id: eventDoc._id,
        model_version: analyzed.model_version ?? 'unknown',
        anomaly_score: analyzed.anomaly_score,
        risk_score: analyzed.risk_score,
        risk_level: analyzed.risk_level,
        threat_type: analyzed.threat_type,
        explanations: analyzed.explanations ?? [],
        features: analyzed.features ?? undefined,
      });

      if (Number(analyzed.risk_score) < config.alertThresholdRisk) {
        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'done' });
        logInfo('risk below threshold; no alert', {
          job_id: job.id,
          event_id,
          risk_score: analyzed.risk_score,
          threshold: config.alertThresholdRisk,
        });
        return;
      }

      const sourceIp = eventDoc.network?.ip;
      const actor = eventDoc.actor?.user ?? eventDoc.actor?.service;

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
          { group_key: groupKey, status: 'open', window_start: windowStart },
          update,
          { new: true, upsert: true }
        );
      } catch (e) {
        // If two workers attempt insert concurrently, unique index may throw; retry as update.
        if (e && e.code === 11000) {
          alert = await Alert.findOneAndUpdate(
            { group_key: groupKey, status: 'open', window_start: windowStart },
            {
              $inc: { event_count: 1, 'counts.occurrences': 1 },
              $set: { last_seen: now, 'counts.last_seen_at': now, updatedAt: now, ...(threatIntel ? { threat_intel: threatIntel } : {}) },
            },
            { new: true }
          );
        } else if (e && String(e.message || '').includes('ConflictingUpdateOperators')) {
          // Defensive fallback: do a minimal update that avoids any nested structure conflicts.
          logError('mongo update conflict; retrying with minimal update', {
            job_id: job.id,
            event_id,
            message: e.message,
          });
          alert = await Alert.findOneAndUpdate(
            { group_key: groupKey, status: 'open', window_start: windowStart },
            {
              $inc: { event_count: 1, 'counts.occurrences': 1 },
              $set: { last_seen: now, updatedAt: now, ...(threatIntel ? { threat_intel: threatIntel } : {}) },
              $setOnInsert: {
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
        logInfo('alert upserted', {
          job_id: job.id,
          event_id,
          alert_id: String(alert._id),
          group_key: alert.group_key,
          window_start: alert.window_start,
          event_count: alert.event_count,
          severity: alert.severity,
          threat_type: alert.threat_type,
        });

        await broadcastAlertCreated(alert);

        const effectiveSeverity = maxSeverity(alert.severity, analyzed.risk_level);
        if (effectiveSeverity !== alert.severity) {
          await Alert.updateOne({ _id: alert._id }, { $set: { severity: effectiveSeverity } });
          alert.severity = effectiveSeverity;
        }

        try {
          await correlateIncidentFromAlert(alert);
          logInfo('incident correlated', {
            job_id: job.id,
            event_id,
            alert_id: String(alert._id),
            actor: alert.actor,
            source_ip: alert.source_ip,
          });
        } catch (e) {
          // Incident correlation should never fail the job.
          logError('incident correlation failed', {
            job_id: job.id,
            event_id,
            alert_id: String(alert._id),
            message: e?.message,
          });
        }

        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'done' });
      } else {
        logError('alert upsert returned null', { job_id: job.id, event_id });
        await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'error' });
      }
    } catch (e) {
      await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'error' });
      logError('job failed', { job_id: job.id, event_id, message: e?.message, stack: e?.stack });
      throw e;
    }
  },
  {
    connection: {
      ...redisConnectionFromUrl(config.redisUrl),
    },
    concurrency: 10,
  }
);

worker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error('job failed', job?.id, err);
});

// eslint-disable-next-line no-console
console.log('worker started');

// Rule-based intelligent alerts (runs on a timer, independent of job processing)
startAlertEngine({ tickMs: 10_000 });
