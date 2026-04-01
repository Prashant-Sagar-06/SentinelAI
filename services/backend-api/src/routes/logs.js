import express from 'express';
import { z } from 'zod';
import { LogEvent } from '../models/LogEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { logger } from '../lib/logger.js';
import { serviceUnavailable } from '../lib/httpError.js';

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
    source: z.string().min(1),
    status: z.string().min(1),
    message: z.string().min(1),
    event_type: z.string().min(1),

    // ✅ NEW: idempotency key
    ingest_id: z.string().optional(),

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

        /* =========================
           TIMESTAMP VALIDATION
        ========================= */

        let timestamp = new Date();

        if (payload.timestamp) {
          const parsed = new Date(payload.timestamp);
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({
              data: null,
              error: { code: 'invalid_timestamp', message: 'Invalid timestamp' },
            });
          }
          timestamp = parsed;
        }

        const timestamp_minute = floorToUtcMinute(timestamp);

        /* =========================
           IDEMPOTENT CREATE
        ========================= */

        let doc;

        try {
          doc = await LogEvent.create({
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
            ingest_id: payload.ingest_id ?? null,
            tags: [],
            analysis_status: 'pending',
          });
        } catch (err) {
          // 🔥 Handle duplicate ingestion (unique index)
          if (err.code === 11000 && payload.ingest_id) {
            const existing = await LogEvent.findOne({
              tenant_id: 'default',
              ingest_id: payload.ingest_id,
            });

            if (existing) {
              return res.json({
                data: {
                  event_id: String(existing._id),
                  queued: false,
                  duplicate: true,
                },
                error: null,
              });
            }
          }
          throw err;
        }

        /* =========================
           QUEUE ENQUEUE
        ========================= */

        const analysisQueue = req.app.get('analysisQueue');

        if (!analysisQueue) {
          throw serviceUnavailable('queue_unavailable', 'Analysis queue unavailable');
        }

        try {
          await analysisQueue.add(
            'analyze_log_event',
            { event_id: String(doc._id) },
            {
              jobId: `analyze_${String(doc._id)}`, // idempotent job
            }
          );
        } catch (e) {
          logger.error(
            { err: e, event_id: String(doc._id) },
            'failed_to_enqueue_analysis_job'
          );

          throw serviceUnavailable('queue_unavailable', 'Analysis queue unavailable');
        }

        /* =========================
           RESPONSE
        ========================= */

        return res.json({
          data: {
            event_id: String(doc._id),
            queued: true,
          },
          error: null,
        });

      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}