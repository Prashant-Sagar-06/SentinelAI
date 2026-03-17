import express from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert.js';
import { requireRole } from '../middleware/rbac.js';

export const alertsRouter = express.Router();

alertsRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

    const query = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.severity) query.severity = String(req.query.severity);
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

const StatusSchema = z.object({});

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
