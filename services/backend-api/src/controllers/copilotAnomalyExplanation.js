import mongoose from 'mongoose';

import { Anomaly } from '../models/Anomaly.js';
import { MetricsMinute } from '../models/MetricsMinute.js';
import { generateExplanation } from '../lib/copilotAnomalyExplanation.js';
import { generateLLMExplanation } from '../ai/anomalyExplanationLLM.js';

function floorToMinute(d) {
  const ms = typeof d?.getTime === 'function' ? d.getTime() : Date.now();
  return new Date(Math.floor(ms / 60_000) * 60_000);
}

export async function getAnomalyExplanation(req, res, next) {
  try {
    const anomalyId = String(req.params.anomalyId ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(anomalyId)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const anomaly = await Anomaly.findById(anomalyId).lean();
    if (!anomaly) {
      return res.status(404).json({ error: 'not_found' });
    }

    const timestampMinute = floorToMinute(anomaly.createdAt);

    const metrics = await MetricsMinute.findOne({ timestamp_minute: timestampMinute }).lean();
    if (!metrics) {
      return res.status(404).json({ error: 'not_found', resource: 'metrics_minute' });
    }

    let explanation;
    try {
      explanation = await generateLLMExplanation(metrics, anomaly);
    } catch {
      explanation = generateExplanation(metrics, anomaly);
    }

    // Preserve legacy field name for existing UIs.
    if (explanation && typeof explanation === 'object') {
      if (!('reason' in explanation) && typeof explanation.root_cause === 'string') {
        explanation.reason = explanation.root_cause;
      }
    }

    return res.json({
      anomaly_id: String(anomaly._id),
      anomaly: {
        type: anomaly.type ?? null,
        score: typeof anomaly.score === 'number' ? anomaly.score : null,
        severity: anomaly.severity ?? null,
        timestamp_minute: timestampMinute.toISOString(),
        createdAt: anomaly.createdAt ? new Date(anomaly.createdAt).toISOString() : null,
      },
      metrics: {
        timestamp_minute: metrics.timestamp_minute ? new Date(metrics.timestamp_minute).toISOString() : null,
        requests: Number(metrics.requests ?? 0),
        error_rate: Number(metrics.error_rate ?? 0),
        avg_latency: Number(metrics.avg_latency ?? 0),
        unique_ips: Number(metrics.unique_ips ?? 0),
      },
      explanation,
    });
  } catch (e) {
    next(e);
  }
}
