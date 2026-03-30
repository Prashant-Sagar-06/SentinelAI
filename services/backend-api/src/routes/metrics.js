import express from 'express';

import { LogEvent } from '../models/LogEvent.js';
import { ok } from '../lib/apiResponse.js';

export const metricsRouter = express.Router();

function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

metricsRouter.get('/summary', async (req, res, next) => {
  try {
    const userId = String(req.user?.sub ?? '');
    const now = Date.now();

    const currentWindowMs = 60_000;
    const baselineWindowMs = 15 * 60_000;

    const currentStart = new Date(now - currentWindowMs);
    const baselineStart = new Date(now - (baselineWindowMs + currentWindowMs));

    const [agg] = await LogEvent.aggregate([
      {
        $match: {
          user_id: userId,
          timestamp: { $gte: baselineStart },
        },
      },
      {
        $project: {
          timestamp: 1,
          ip: { $ifNull: ['$network.ip', null] },
          status: { $toLower: { $ifNull: ['$status', ''] } },
          latency: {
            $convert: {
              input: '$attributes.latency',
              to: 'double',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $facet: {
          current: [
            {
              $match: {
                timestamp: { $gte: currentStart },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                errors: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['error', 'failed']] }, 1, 0],
                  },
                },
                avg_latency_ms: { $avg: '$latency' },
              },
            },
          ],
          top_ips: [
            {
              $match: {
                timestamp: { $gte: currentStart },
                ip: { $ne: null },
              },
            },
            {
              $group: {
                _id: '$ip',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                ip: '$_id',
                count: 1,
              },
            },
          ],
          baseline: [
            {
              $match: {
                timestamp: { $gte: baselineStart, $lt: currentStart },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                errors: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['error', 'failed']] }, 1, 0],
                  },
                },
                avg_latency_ms: { $avg: '$latency' },
              },
            },
          ],
        },
      },
    ]);

    const cur = (agg?.current && agg.current[0]) || { total: 0, errors: 0, avg_latency_ms: 0 };
    const base = (agg?.baseline && agg.baseline[0]) || { total: 0, errors: 0, avg_latency_ms: 0 };

    const requests_per_minute = toNumberOrZero(cur.total);
    // Canonical: 0..1 (not percent)
    const errorRate = requests_per_minute > 0 ? toNumberOrZero(cur.errors) / requests_per_minute : 0;
    const avg_latency_ms = toNumberOrZero(cur.avg_latency_ms);

    const baselineAvgLatency = toNumberOrZero(base.avg_latency_ms);

    const errorAnomaly = errorRate > 0.2;
    const latencyAnomaly =
      baselineAvgLatency > 0 && avg_latency_ms > 0 && avg_latency_ms > baselineAvgLatency * 2;

    return ok(res, {
      requests_per_minute,
      error_rate: Number(errorRate.toFixed(4)),
      avg_latency_ms: Number(avg_latency_ms.toFixed(2)),
      anomaly: Boolean(errorAnomaly || latencyAnomaly),
      top_ips: Array.isArray(agg?.top_ips) ? agg.top_ips : [],
    });
  } catch (e) {
    next(e);
  }
});
