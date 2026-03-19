import express from 'express';

import { LogEvent } from '../models/LogEvent.js';

export const metricsRouter = express.Router();

function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

metricsRouter.get('/summary', async (req, res, next) => {
  try {
    const now = Date.now();

    const currentWindowMs = 60_000;
    const baselineWindowMs = 15 * 60_000;

    const currentStart = new Date(now - currentWindowMs);
    const baselineStart = new Date(now - (baselineWindowMs + currentWindowMs));

    const [agg] = await LogEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: baselineStart },
        },
      },
      {
        $project: {
          timestamp: 1,
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
                    $cond: [{ $eq: ['$status', 'error'] }, 1, 0],
                  },
                },
                avg_latency_ms: { $avg: '$latency' },
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
                    $cond: [{ $eq: ['$status', 'error'] }, 1, 0],
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
    const errorRate = requests_per_minute > 0 ? (toNumberOrZero(cur.errors) / requests_per_minute) * 100 : 0;
    const avg_latency_ms = toNumberOrZero(cur.avg_latency_ms);

    const baselineAvgLatency = toNumberOrZero(base.avg_latency_ms);

    const errorAnomaly = errorRate > 20;
    const latencyAnomaly =
      baselineAvgLatency > 0 && avg_latency_ms > 0 && avg_latency_ms > baselineAvgLatency * 2;

    res.json({
      requests_per_minute,
      error_rate: Number(errorRate.toFixed(2)),
      avg_latency_ms: Number(avg_latency_ms.toFixed(2)),
      anomaly: Boolean(errorAnomaly || latencyAnomaly),
    });
  } catch (e) {
    next(e);
  }
});
