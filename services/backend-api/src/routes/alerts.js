import express from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert.js';
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
    res.json({ alert });
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
