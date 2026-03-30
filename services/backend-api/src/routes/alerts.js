import express from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert.js';
import { LogEvent } from '../models/LogEvent.js';
import { AnomalyResult } from '../models/AnomalyResult.js';
import { requireRole } from '../middleware/rbac.js';
import { ok } from '../lib/apiResponse.js';
import { badRequest, notFound } from '../lib/httpError.js';

export const alertsRouter = express.Router();

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().datetime().optional(),
  status: z.string().min(1).optional(),
  severity: z.string().min(1).optional(),
});

alertsRouter.get('/', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const parsed = ListQuerySchema.safeParse({
      limit: first(req.query.limit),
      cursor: first(req.query.cursor),
      status: first(req.query.status),
      severity: first(req.query.severity),
    });

    if (!parsed.success) {
      return next(badRequest('invalid_query', 'Invalid query parameters', parsed.error.flatten()));
    }

    const q = parsed.data;
    const limit = q.limit;
    const cursor = q.cursor ? new Date(q.cursor) : null;

    const query = { user_id: userId };
    // Default behavior for this endpoint: return active alerts.
    // Clients can override by specifying an explicit status.
    if (q.status) query.status = q.status;
    else query.status = 'open';
    if (q.severity) query.severity = q.severity;
    if (cursor) query.createdAt = { $lt: cursor };

    const items = await Alert.find(query).sort({ createdAt: -1 }).limit(limit);
    const nextCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;
    return ok(res, { items, nextCursor });
  } catch (e) {
    next(e);
  }
});

alertsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const alert = await Alert.findOne({ _id: req.params.id, user_id: userId });
    if (!alert) return next(notFound('not_found', 'Not found'));

    const or = [];
    if (alert.source_ip) {
      or.push({ 'network.ip': String(alert.source_ip) });
    }

    if (alert.actor) {
      const a = String(alert.actor);
      or.push({ 'actor.user': a });
      or.push({ 'actor.service': a });
    }

    const related_logs = or.length
      ? await LogEvent.find({ user_id: userId, $or: or })
          .sort({ timestamp: -1 })
          .limit(20)
          .select({ timestamp: 1, event_type: 1, message: 1, source: 1, actor: 1, network: 1 })
      : [];

      const ai = await AnomalyResult.findOne({ event_id: alert.event_id, user_id: userId })
      .sort({ createdAt: -1 })
      .select({
        explanations: 1,
        model_version: 1,
        anomaly_score: 1,
        risk_score: 1,
        risk_level: 1,
        threat_type: 1,
        createdAt: 1,
      });

    const ai_analysis = ai
      ? {
          explanations: Array.isArray(ai.explanations) ? ai.explanations : [],
          model_version: ai.model_version,
          anomaly_score: ai.anomaly_score,
          risk_score: ai.risk_score,
          risk_level: ai.risk_level,
          threat_type: ai.threat_type,
          createdAt: ai.createdAt,
        }
      : { explanations: [] };

    return ok(res, { alert, related_logs, ai_analysis });
  } catch (e) {
    next(e);
  }
});

const AssignBodySchema = z.object({
  assigned_to: z.union([z.string().min(1).max(200), z.null()]),
});

alertsRouter.post('/:id/assign', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const parsed = AssignBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('invalid_body', 'Invalid request body', parsed.error.flatten()));
    }

    const assigned_to = parsed.data.assigned_to;
    const update = {
      assigned_to,
      assigned_at: assigned_to ? new Date() : null,
      updatedAt: new Date(),
    };

    const updated = await Alert.findOneAndUpdate({ _id: req.params.id, user_id: userId }, update, { new: true });
    if (!updated) return next(notFound('not_found', 'Not found'));
    return ok(res, { alert: updated });
  } catch (e) {
    next(e);
  }
});

alertsRouter.post('/:id/ack', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const updated = await Alert.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      { status: 'ack', updatedAt: new Date() },
      { new: true }
    );
    if (!updated) return next(notFound('not_found', 'Not found'));
    return ok(res, { alert: updated });
  } catch (e) {
    next(e);
  }
});

alertsRouter.post('/:id/close', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const updated = await Alert.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      { status: 'closed', updatedAt: new Date() },
      { new: true }
    );
    if (!updated) return next(notFound('not_found', 'Not found'));
    return ok(res, { alert: updated });
  } catch (e) {
    next(e);
  }
});
