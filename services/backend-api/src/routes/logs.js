import express from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { LogEvent } from '../models/LogEvent.js';
import { validateBody } from '../middleware/validate.js';

export function createLogsRouter(analysisQueue) {
  const logsRouter = express.Router();

  const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    source: z.string().min(1).optional(),
    event_type: z.string().min(1).optional(),
    actor: z.string().min(1).optional(),
    ip: z.string().min(1).optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
  });

  function first(v) {
    return Array.isArray(v) ? v[0] : v;
  }

  logsRouter.get('/', async (req, res, next) => {
    try {
      const q = QuerySchema.parse({
        page: first(req.query.page),
        limit: first(req.query.limit),
        source: first(req.query.source),
        event_type: first(req.query.event_type),
        actor: first(req.query.actor),
        ip: first(req.query.ip),
        start_time: first(req.query.start_time),
        end_time: first(req.query.end_time),
      });

      const filter = {};
      if (q.source) filter.source = q.source;
      if (q.event_type) filter.event_type = q.event_type;
      if (q.ip) filter['network.ip'] = q.ip;
      if (q.actor) {
        filter.$or = [{ 'actor.user': q.actor }, { 'actor.service': q.actor }];
      }
      if (q.start_time || q.end_time) {
        filter.timestamp = {};
        if (q.start_time) filter.timestamp.$gte = new Date(q.start_time);
        if (q.end_time) filter.timestamp.$lte = new Date(q.end_time);
      }

      const skip = (q.page - 1) * q.limit;

      const [total, docs] = await Promise.all([
        LogEvent.countDocuments(filter),
        LogEvent.find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(q.limit)
          .select({ timestamp: 1, source: 1, event_type: 1, actor: 1, network: 1, attributes: 1 })
          .lean(),
      ]);

      const data = docs.map((d) => ({
        event_id: String(d._id),
        timestamp: d.timestamp?.toISOString?.() ?? d.timestamp,
        source: d.source,
        event_type: d.event_type,
        actor: d.actor?.user ?? d.actor?.service ?? null,
        ip: d.network?.ip ?? null,
        attributes: d.attributes ?? {},
      }));

      res.json({ data, page: q.page, limit: q.limit, total });
    } catch (e) {
      next(e);
    }
  });

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
