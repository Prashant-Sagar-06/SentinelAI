import express from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert.js';
import { LogEvent } from '../models/LogEvent.js';
import { AnomalyResult } from '../models/AnomalyResult.js';
import { requireRole } from '../middleware/rbac.js';

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
    const parsed = ListQuerySchema.safeParse({
      limit: first(req.query.limit),
      cursor: first(req.query.cursor),
      status: first(req.query.status),
      severity: first(req.query.severity),
    });

    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const q = parsed.data;
    const limit = q.limit;
    const cursor = q.cursor ? new Date(q.cursor) : null;

    const query = {};
    if (q.status) query.status = q.status;
    if (q.severity) query.severity = q.severity;
    if (cursor) query.createdAt = { $lt: cursor };

    const items = await Alert.find(query).sort({ createdAt: -1 }).limit(limit);
    const nextCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;
    res.json({ items, nextCursor });
  } catch (e) {
    next(e);
  }
});

alertsRouter.get('/:id', async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'not_found' });

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
      ? await LogEvent.find({ $or: or })
          .sort({ timestamp: -1 })
          .limit(20)
          .select({ timestamp: 1, event_type: 1, message: 1, source: 1, actor: 1, network: 1 })
      : [];

    const ai = await AnomalyResult.findOne({ event_id: alert.event_id })
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

    res.json({ alert, related_logs, ai_analysis });
  } catch (e) {
    next(e);
  }
});

const AssignBodySchema = z.object({
  assigned_to: z.union([z.string().min(1).max(200), z.null()]),
});

alertsRouter.post('/:id/assign', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const parsed = AssignBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const assigned_to = parsed.data.assigned_to;
    const update = {
      assigned_to,
      assigned_at: assigned_to ? new Date() : null,
      updatedAt: new Date(),
    };

    const updated = await Alert.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ alert: updated });
  } catch (e) {
    next(e);
  }
});

alertsRouter.post('/:id/ack', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const updated = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'ack', updatedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ alert: updated });
  } catch (e) {
    next(e);
  }
});

alertsRouter.post('/:id/close', requireRole(['admin', 'analyst']), async (req, res, next) => {
  try {
    const updated = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', updatedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ alert: updated });
  } catch (e) {
    next(e);
  }
});
