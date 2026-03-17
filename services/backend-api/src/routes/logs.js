import express from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { LogEvent } from '../models/LogEvent.js';
import { validateBody } from '../middleware/validate.js';

export function createLogsRouter(analysisQueue) {
  const logsRouter = express.Router();

const ActorSchema = z
  .object({ user: z.string().optional(), service: z.string().optional(), role: z.string().optional() })
  .optional();

const NetworkSchema = z.object({ ip: z.string().optional(), user_agent: z.string().optional() }).optional();

const SecurityEventSchema = z.object({
  timestamp: z.string().datetime(),
  source: z.string().min(1),
  event_type: z.string().min(1),
  message: z.string().optional(),
  status: z.string().optional(),
  severity_hint: z.string().optional(),
  tenant_id: z.string().optional(),
  ingest_id: z.string().optional(),
  actor: ActorSchema,
  network: NetworkSchema,
  attributes: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

function normalizeEvent(input) {
  const ts = new Date(input.timestamp);
  return {
    timestamp: ts,
    source: input.source,
    event_type: input.event_type,
    message: input.message,
    status: input.status,
    severity_hint: input.severity_hint,
    tenant_id: input.tenant_id ?? 'default',
    ingest_id: input.ingest_id ?? `auto_${nanoid(12)}`,
    actor: input.actor,
    network: input.network,
    attributes: input.attributes ?? {},
    tags: input.tags ?? [],
  };
}

  logsRouter.post('/', validateBody(SecurityEventSchema), async (req, res, next) => {
    try {
      const normalized = normalizeEvent(req.body);
      const doc = await LogEvent.create({ ...normalized, raw: req.body, analysis_status: 'pending' });
      await analysisQueue.add('analyze_event', { event_id: String(doc._id) });
      res.status(201).json({ event_id: String(doc._id) });
    } catch (e) {
      next(e);
    }
  });

const BatchSchema = z.object({ events: z.array(SecurityEventSchema).min(1).max(1000) });

  logsRouter.post('/batch', validateBody(BatchSchema), async (req, res, next) => {
    try {
      const normalized = req.body.events.map((e) => ({
        ...normalizeEvent(e),
        raw: e,
        analysis_status: 'pending',
      }));
      const created = await LogEvent.insertMany(normalized, { ordered: false });
      const eventIds = created.map((d) => String(d._id));
      await analysisQueue.addBulk(
        eventIds.map((id) => ({
          name: 'analyze_event',
          data: { event_id: id },
        }))
      );
      res.status(201).json({ event_ids: eventIds });
    } catch (e) {
      next(e);
    }
  });

  return logsRouter;
}
