import express from 'express';
import rateLimit from 'express-rate-limit';

import { Alert } from '../models/Alert.js';
import { config } from '../config.js';
import { buildSocMessages, generateCopilotResponse, normalizeCopilotPayload } from '../lib/llm.js';

export const copilotRouter = express.Router();

const copilotLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.copilotRateLimitPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip,
});

function toSafeAlert(alertDoc) {
  const explanations = [];
  if (typeof alertDoc.reason === 'string' && alertDoc.reason.trim()) {
    explanations.push(...alertDoc.reason.split(';').map((s) => s.trim()).filter(Boolean));
  }

  return {
    alert_id: String(alertDoc._id),
    title: alertDoc.title,
    threat_type: alertDoc.threat_type,
    severity: alertDoc.severity,
    status: alertDoc.status,
    explanations,
    actor: alertDoc.actor ?? null,
    source_ip: alertDoc.source_ip ?? null,
    event_count: alertDoc.event_count ?? alertDoc.counts?.occurrences ?? 1,
    first_seen: alertDoc.first_seen ?? alertDoc.counts?.first_seen_at ?? alertDoc.createdAt ?? null,
    last_seen: alertDoc.last_seen ?? alertDoc.counts?.last_seen_at ?? alertDoc.updatedAt ?? null,
    createdAt: alertDoc.createdAt ?? null,
    updatedAt: alertDoc.updatedAt ?? null,
  };
}

copilotRouter.get('/explain/:alertId', copilotLimiter, async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'not_found' });

    const safeAlert = toSafeAlert(alert);
    const messages = buildSocMessages(safeAlert);
    const content = await generateCopilotResponse(messages);
    const normalized = normalizeCopilotPayload(content || '');

    res.json({
      alert_id: safeAlert.alert_id,
      analysis: normalized.analysis,
      evidence: normalized.evidence,
      recommended_actions: normalized.recommended_actions,
    });
  } catch (e) {
    next(e);
  }
});
