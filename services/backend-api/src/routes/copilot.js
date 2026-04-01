import express from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';

import { Alert } from '../models/Alert.js';
import { Anomaly } from '../models/Anomaly.js';
import { config } from '../config.js';
import { getAnomalyExplanation } from '../controllers/copilotAnomalyExplanation.js';
import { buildSocMessages, generateCopilotResponse, normalizeCopilotPayload } from '../lib/llm.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { copilotLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { ok } from '../lib/apiResponse.js';

export const copilotRouter = express.Router();

copilotRouter.use(copilotLimiter);

function toSafeAlert(alertDoc) {
  const explanations = [];
  if (typeof alertDoc.reason === 'string' && alertDoc.reason.trim()) {
    explanations.push(...alertDoc.reason.split(';').map((s) => s.trim()).filter(Boolean));
  }

  return {
    alert_id: String(alertDoc._id),
    title: alertDoc.title,
    type: alertDoc.type ?? null,
    message: alertDoc.message ?? null,
    threat_type: alertDoc.threat_type,
    severity: alertDoc.severity,
    status: alertDoc.status,
    explanations,
    actor: alertDoc.actor ?? null,
    source_ip: alertDoc.source_ip ?? null,
    threat_intel: alertDoc.threat_intel ?? null,
    metadata: alertDoc.metadata ?? {},
    event_count: alertDoc.event_count ?? alertDoc.counts?.occurrences ?? 1,
    first_seen: alertDoc.first_seen ?? alertDoc.counts?.first_seen_at ?? alertDoc.createdAt ?? null,
    last_seen: alertDoc.last_seen ?? alertDoc.counts?.last_seen_at ?? alertDoc.updatedAt ?? null,
    createdAt: alertDoc.createdAt ?? null,
    updatedAt: alertDoc.updatedAt ?? null,
  };
}

function toSafeAnomaly(anomalyDoc) {
  if (!anomalyDoc) return null;
  return {
    type: anomalyDoc.type ?? null,
    score: typeof anomalyDoc.score === 'number' ? anomalyDoc.score : null,
    severity: anomalyDoc.severity ?? null,
    message: anomalyDoc.message ?? null,
    reason: anomalyDoc.reason ?? null,
    metadata: anomalyDoc.metadata ?? {},
    createdAt: anomalyDoc.createdAt ?? null,
  };
}

async function callAiEngineAnalyzeAlert(payload) {
  const base = config.aiEngineUrl ? config.aiEngineUrl.replace(/\/$/, '') : '';
  if (!base) throw new Error('missing_ai_engine_url');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(`${base}/analyze-alert`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json?.error || 'ai_engine_error');
      err.status = res.status;
      throw err;
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

copilotRouter.get('/explain/:id', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const id = String(req.params.id ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(badRequest('invalid_id', 'Invalid id'));
    }

    // Prefer anomaly explanations (deterministic) when the ID matches an anomaly.
    const anomaly = await Anomaly.findOne({ _id: id, user_id: userId }).select({ _id: 1 }).lean();
    if (anomaly) {
      // Delegate to the anomaly controller to keep logic modular.
      req.params.anomalyId = id;
      return getAnomalyExplanation(req, res, next);
    }

    // Fallback: existing alert explanation behavior.
    const alert = await Alert.findOne({ _id: id, user_id: userId });
    if (!alert) return next(notFound('not_found', 'Not found'));

    const safeAlert = toSafeAlert(alert);
    const messages = buildSocMessages(safeAlert);
    const content = await generateCopilotResponse(messages);
    const normalized = normalizeCopilotPayload(content || '');

    return ok(res, {
      alert_id: safeAlert.alert_id,
      analysis: normalized.analysis,
      evidence: normalized.evidence,
      recommended_actions: normalized.recommended_actions,
    });
  } catch (e) {
    next(e);
  }
});

const AnalyzeBodySchema = z
  .object({
    alertId: z.string().min(1),
  })
  .strict();

copilotRouter.post('/analyze', validateBody(AnalyzeBodySchema), async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const alert = await Alert.findOne({ _id: req.body.alertId, user_id: userId });
    if (!alert) return next(notFound('not_found', 'Not found'));

    const safeAlert = toSafeAlert(alert);
    const anomaly = await Anomaly.findOne({ user_id: userId, alert_id: alert._id }).sort({ createdAt: -1 });
    const safeAnomaly = toSafeAnomaly(anomaly);

    let normalized;
    const ai = await callAiEngineAnalyzeAlert({ alert: safeAlert, anomaly: safeAnomaly });
    normalized = normalizeCopilotPayload(ai);

    return ok(res, {
      alert_id: safeAlert.alert_id,
      analysis: normalized.analysis,
      evidence: normalized.evidence,
      recommended_actions: normalized.recommended_actions,
      risk_level: normalized.risk_level,
      threat_intel: normalized.threat_intel,
    });
  } catch (e) {
    next(e);
  }
});
