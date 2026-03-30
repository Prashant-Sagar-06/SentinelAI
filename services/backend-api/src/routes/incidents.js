import express from 'express';
import { z } from 'zod';

import { Incident } from '../models/Incident.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { ok } from '../lib/apiResponse.js';
import { badRequest, notFound } from '../lib/httpError.js';

export const incidentsRouter = express.Router();

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['open', 'investigating', 'resolved']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

incidentsRouter.get('/', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const parsed = ListQuerySchema.safeParse({
      page: first(req.query.page),
      limit: first(req.query.limit),
      status: first(req.query.status),
      severity: first(req.query.severity),
    });

    if (!parsed.success) {
      return next(badRequest('invalid_query', 'Invalid query parameters', parsed.error.flatten()));
    }

    const q = parsed.data;

    const filter = { user_id: userId };
    if (q.status) filter.status = q.status;
    if (q.severity) filter.severity = q.severity;

    const skip = (q.page - 1) * q.limit;

    const [total, incidents] = await Promise.all([
      Incident.countDocuments(filter),
      Incident.find(filter)
        .sort({ last_seen: -1, createdAt: -1 })
        .skip(skip)
        .limit(q.limit)
        .lean(),
    ]);

    return ok(res, { incidents, page: q.page, total });
  } catch (e) {
    next(e);
  }
});

incidentsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const idParsed = ObjectIdSchema.safeParse(req.params.id);
    if (!idParsed.success) return next(badRequest('invalid_id', 'Invalid id'));
    const id = idParsed.data;

    const incident = await Incident.findOne({ _id: id, user_id: userId }).populate({
      path: 'alerts',
      options: { sort: { createdAt: -1 } },
      match: { user_id: userId },
      select: {
        title: 1,
        severity: 1,
        status: 1,
        threat_type: 1,
        group_key: 1,
        reason: 1,
        actor: 1,
        source_ip: 1,
        event_count: 1,
        first_seen: 1,
        last_seen: 1,
        window_start: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    if (!incident) return next(notFound('not_found', 'Not found'));
    return ok(res, { incident });
  } catch (e) {
    next(e);
  }
});

const PatchSchema = z
  .object({
    status: z.enum(['open', 'investigating', 'resolved']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assigned_to: z.union([z.string().min(1).max(200), z.null()]).optional(),
    notes: z.union([z.string().max(10_000), z.null()]).optional(),
  })
  .strict();

incidentsRouter.patch('/:id', requireRole(['admin', 'analyst']), validateBody(PatchSchema), async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const idParsed = ObjectIdSchema.safeParse(req.params.id);
    if (!idParsed.success) return next(badRequest('invalid_id', 'Invalid id'));
    const id = idParsed.data;
    const patch = req.body;

    const $set = { updatedAt: new Date() };
    if (patch.status !== undefined) $set.status = patch.status;
    if (patch.severity !== undefined) $set.severity = patch.severity;
    if (patch.assigned_to !== undefined) $set.assigned_to = patch.assigned_to;
    if (patch.notes !== undefined) $set.notes = patch.notes;

    const updated = await Incident.findOneAndUpdate({ _id: id, user_id: userId }, { $set }, { new: true, runValidators: true });
    if (!updated) return next(notFound('not_found', 'Not found'));

    return ok(res, { incident: updated });
  } catch (e) {
    next(e);
  }
});
