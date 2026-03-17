import { Worker } from 'bullmq';

import { requireEnv, config } from './config.js';
import { connectMongo } from './db.js';
import { LogEvent } from './models/LogEvent.js';
import { AnomalyResult } from './models/AnomalyResult.js';
import { Alert } from './models/Alert.js';
import { redisConnectionFromUrl } from './redis.js';

requireEnv();
await connectMongo();

function deriveGroupKey({ threatType, sourceIp, actor, timestamp }) {
  const ip = sourceIp || 'unknown_ip';
  const who = actor || 'unknown_actor';
  const bucketMinutes = 15;
  const ts = new Date(timestamp);
  const bucket = new Date(Math.floor(ts.getTime() / (bucketMinutes * 60_000)) * (bucketMinutes * 60_000));
  return `${threatType}:${ip}:${who}:${bucket.toISOString()}`;
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
    const eventDoc = await LogEvent.findById(event_id);
    if (!eventDoc) return;

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

      await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'done' });

      if (Number(analyzed.risk_score) < config.alertThresholdRisk) {
        return;
      }

      const sourceIp = eventDoc.network?.ip;
      const actor = eventDoc.actor?.user ?? eventDoc.actor?.service;
      const groupKey = deriveGroupKey({
        threatType: analyzed.threat_type,
        sourceIp,
        actor,
        timestamp: eventDoc.timestamp,
      });

      const title = titleForThreat(analyzed.threat_type);
      const reason = (analyzed.explanations ?? []).slice(0, 3).join('; ') || 'Risk score exceeded threshold';

      const now = new Date();

      const existing = await Alert.findOne({ group_key: groupKey, status: { $in: ['open', 'ack'] } });
      if (existing) {
        existing.counts.occurrences += 1;
        existing.counts.last_seen_at = now;
        existing.updatedAt = now;
        // escalate severity if needed
        const order = ['low', 'medium', 'high', 'critical'];
        if (order.indexOf(analyzed.risk_level) > order.indexOf(existing.severity)) {
          existing.severity = analyzed.risk_level;
        }
        await existing.save();
      } else {
        await Alert.create({
          event_id: eventDoc._id,
          title,
          severity: analyzed.risk_level,
          status: 'open',
          threat_type: analyzed.threat_type,
          group_key: groupKey,
          reason,
          source_ip: sourceIp,
          actor,
          counts: {
            occurrences: 1,
            first_seen_at: now,
            last_seen_at: now,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (e) {
      await LogEvent.findByIdAndUpdate(eventDoc._id, { analysis_status: 'error' });
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
