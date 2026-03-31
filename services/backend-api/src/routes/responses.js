import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { Response } from '../models/Response.js';
import { badRequest } from '../lib/httpError.js';
import { ok } from '../lib/apiResponse.js';

export const responsesRouter = express.Router();

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

const QuerySchema = z
  .object({
    anomaly_id: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  })
  .strict();

responsesRouter.get('/', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const parsed = QuerySchema.safeParse({
      anomaly_id: first(req.query.anomaly_id),
      limit: first(req.query.limit),
    });

    if (!parsed.success) return next(badRequest('invalid_query', 'Invalid query parameters', parsed.error.flatten()));

    const { anomaly_id: anomalyId, limit } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(anomalyId)) {
      return next(badRequest('invalid_anomaly_id', 'Invalid anomaly_id'));
    }

    const items = await Response.find({ user_id: userId, anomaly_id: anomalyId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return ok(res, { items });
  } catch (e) {
    next(e);
  }
});
