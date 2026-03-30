import express from 'express';
import { z } from 'zod';
import { LogEvent } from '../models/LogEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { logger } from '../lib/logger.js';

const ONE_MINUTE_MS = 60_000;

function floorToUtcMinute(date) {
  const d = date instanceof Date ? date : new Date(date);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(Math.floor(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

export function createLogsRouter() {
  const router = express.Router();

  const LogSchema = z.object({
    source: z.string(),
    status: z.string(),
    message: z.string(),
    event_type: z.string(),
    timestamp: z.string().optional(),
    network: z.object({
      ip: z.string().optional(),
    }).passthrough().optional(),
    attributes: z.object({
      latency: z.number().optional(),
    }).passthrough().optional(),
  });

  router.post(
    '/',
    requireAuth,
    validateBody(LogSchema),
    async (req, res, next) => {
      try {
        const user_id = String(req.user.sub);

        const payload = req.body;

        const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
        const timestamp_minute = floorToUtcMinute(timestamp);

        const doc = await LogEvent.create({
          user_id,
          timestamp,
          timestamp_minute,
          source: payload.source,
          status: payload.status,
          message: payload.message,
          event_type: payload.event_type,
          network: payload.network || {},
          attributes: payload.attributes || {},
          raw: payload,
          tenant_id: 'default',
          tags: [],
          analysis_status: 'pending',
        });

        let queued = false;
        const analysisQueue = req.app.get('analysisQueue');
        if (analysisQueue) {
          try {
            await analysisQueue.add(
              'analyze_log_event',
              { event_id: String(doc._id) },
              { jobId: `analyze_${String(doc._id)}` }
            );
            queued = true;
          } catch (e) {
            logger.warn({ err: e, event_id: String(doc._id) }, 'failed to enqueue analysis job');
          }
        }

        res.json({
          data: { event_id: String(doc._id), queued },
          error: null,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}