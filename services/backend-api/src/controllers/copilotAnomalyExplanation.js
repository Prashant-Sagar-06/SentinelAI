import mongoose from 'mongoose';

import { Anomaly } from '../models/Anomaly.js';
import { MetricsMinute } from '../models/MetricsMinute.js';
import { generateExplanation } from '../lib/copilotAnomalyExplanation.js';
import { generateLLMExplanation } from '../ai/anomalyExplanationLLM.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { ok } from '../lib/apiResponse.js';

function floorToMinute(d) {
  const ms = typeof d?.getTime === 'function' ? d.getTime() : Date.now();
  return new Date(Math.floor(ms / 60_000) * 60_000);
}

function toValidDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ensureExplanationShape(explanation) {
  const src = explanation && typeof explanation === 'object' ? explanation : {};

  const summary = typeof src.summary === 'string' && src.summary.trim()
    ? src.summary
    : 'Anomaly explanation unavailable.';

  const rootCause = typeof src.root_cause === 'string' && src.root_cause.trim()
    ? src.root_cause
    : typeof src.reason === 'string' && src.reason.trim()
      ? src.reason
      : 'Unknown';

  const impact = typeof src.impact === 'string' && src.impact.trim()
    ? src.impact
    : 'Potential impact: unknown.';

  const recommendation = typeof src.recommendation === 'string' && src.recommendation.trim()
    ? src.recommendation
    : 'Investigate logs and metrics around the anomaly minute.';

  const c = Number(src.confidence);
  const confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.4;

  return {
    summary,
    root_cause: rootCause,
    impact,
    recommendation,
    confidence,
  };
}

export async function getAnomalyExplanation(req, res, next) {
  try {
    const userId = String(req.user?.sub ?? '');
    const anomalyId = String(req.params.anomalyId ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(anomalyId)) {
      return next(badRequest('invalid_id', 'Invalid id'));
    }

    const anomaly = await Anomaly.findOne({ _id: anomalyId, user_id: userId }).lean();
    if (!anomaly) {
      return next(notFound('not_found', 'Not found'));
    }

    // Join strictly using timestamp_minute.
    // Backward compatibility: allow anomaly.metadata.current.timestamp_minute (still timestamp_minute-based).
    const anomalyMinute = toValidDate(anomaly?.timestamp_minute);
    const metaMinute = toValidDate(anomaly?.metadata?.current?.timestamp_minute);
    const timestampMinute = anomalyMinute ? floorToMinute(anomalyMinute) : metaMinute ? floorToMinute(metaMinute) : null;
    if (!timestampMinute) {
      return next(badRequest('missing_timestamp_minute', 'Anomaly is missing timestamp_minute'));
    }

    const metrics = await MetricsMinute.findOne({ user_id: userId, timestamp_minute: timestampMinute }).lean();

    const metricsForExplain = metrics || {
      timestamp_minute: timestampMinute,
      requests: null,
      error_rate: null,
      avg_latency: null,
      unique_ips: null,
      missing: true,
    };

    let explanation;
    try {
      explanation = await generateLLMExplanation(metricsForExplain, anomaly);
    } catch {
      explanation = generateExplanation(metricsForExplain, anomaly);
    }

    explanation = ensureExplanationShape(explanation);

    return ok(res, {
      anomaly_id: String(anomaly._id),
      anomaly: {
        type: anomaly.type ?? null,
        score: typeof anomaly.score === 'number' ? anomaly.score : null,
        confidence: typeof anomaly.confidence === 'number' ? anomaly.confidence : null,
        severity: anomaly.severity ?? null,
        timestamp_minute: timestampMinute.toISOString(),
        createdAt: anomaly.createdAt ? new Date(anomaly.createdAt).toISOString() : null,
      },
      metrics: {
        timestamp_minute: metrics?.timestamp_minute ? new Date(metrics.timestamp_minute).toISOString() : timestampMinute.toISOString(),
        requests: metrics?.requests == null ? null : Number(metrics.requests ?? 0),
        error_rate: metrics?.error_rate == null ? null : Number(metrics.error_rate ?? 0),
        avg_latency: metrics?.avg_latency == null ? null : Number(metrics.avg_latency ?? 0),
        unique_ips: metrics?.unique_ips == null ? null : Number(metrics.unique_ips ?? 0),
        missing: metrics ? false : true,
      },
      explanation,
    });
  } catch (e) {
    next(e);
  }
}
