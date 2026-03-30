import express from 'express';
import { z } from 'zod';

import { Anomaly } from '../models/Anomaly.js';
import { badRequest } from '../lib/httpError.js';
import { ok } from '../lib/apiResponse.js';

export const anomaliesRouter = express.Router();

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().datetime().optional(),
  severity: z.string().min(1).optional(),
});

anomaliesRouter.get('/', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const parsed = ListQuerySchema.safeParse({
      limit: first(req.query.limit),
      cursor: first(req.query.cursor),
      severity: first(req.query.severity),
    });

    if (!parsed.success) return next(badRequest('invalid_query', 'Invalid query parameters', parsed.error.flatten()));

    const q = parsed.data;
    const limit = q.limit;
    const cursor = q.cursor ? new Date(q.cursor) : null;

    const query = { user_id: userId };
    if (q.severity) query.severity = q.severity;
    if (cursor) query.createdAt = { $lt: cursor };

    const items = await Anomaly.find(query).sort({ createdAt: -1 }).limit(limit);
    const nextCursor = items.length ? items[items.length - 1].createdAt.toISOString() : null;

    return ok(res, { items, nextCursor });
  } catch (e) {
    next(e);
  }
});
