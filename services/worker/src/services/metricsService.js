import { LogEvent } from '../models/LogEvent.js';
import { MetricsMinute } from '../models/MetricsMinute.js';
import { safeRedisSet } from '../redisClient.js';
import { logger } from '../lib/logger.js';

const ONE_MINUTE_MS = 60_000;
const METRICS_DEBUG = process.env.METRICS_DEBUG === '1' || process.env.METRICS_DEBUG === 'true';
const ACTIVE_TENANT_LOOKBACK_MINUTES = Number(process.env.METRICS_ACTIVE_TENANT_LOOKBACK_MINUTES ?? 60);
const MIN_HISTORY_TARGET = Number(process.env.MIN_METRICS_HISTORY_FOR_ANOMALY ?? 10);

function logInfo(message, meta) {
  logger.info({ component: 'metrics-minute', ...(meta ?? {}) }, message);
}

function logError(message, meta) {
  logger.error({ component: 'metrics-minute', ...(meta ?? {}) }, message);
}

function floorToUtcMinute(date) {
  const t = date.getTime();
  return new Date(Math.floor(t / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

function computePreviousMinuteWindowUtc(now = new Date()) {
  const end = floorToUtcMinute(now);
  const start = new Date(end.getTime() - ONE_MINUTE_MS);
  return { start, end };
}

async function getActiveUserIds({ now = new Date() } = {}) {
  const lookbackMinutes = Number.isFinite(ACTIVE_TENANT_LOOKBACK_MINUTES) && ACTIVE_TENANT_LOOKBACK_MINUTES > 0
    ? ACTIVE_TENANT_LOOKBACK_MINUTES
    : 60;
  const since = new Date(now.getTime() - lookbackMinutes * ONE_MINUTE_MS);
  const userIds = await LogEvent.distinct('user_id', {
    user_id: { $exists: true, $type: 'string', $ne: '' },
    timestamp: { $gte: since },
  }).catch(() => []);

  return (Array.isArray(userIds) ? userIds : []).map((x) => String(x)).filter(Boolean);
}

export async function aggregateMinute({ minute = null } = {}) {
  const now = new Date();

  let start;
  let end;
  if (minute) {
    const startCandidate = new Date(minute);
    if (Number.isNaN(startCandidate.getTime())) {
      throw new Error(`Invalid minute argument: ${String(minute)}`);
    }
    start = floorToUtcMinute(startCandidate);
    end = new Date(start.getTime() + ONE_MINUTE_MS);
  } else {
    ({ start, end } = computePreviousMinuteWindowUtc(now));
  }

  logInfo('window', {
    now: now.toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
  });

  const t0 = Date.now();

  if (METRICS_DEBUG) {
    const matchCount = await LogEvent.countDocuments({
      timestamp: { $gte: start, $lt: end },
      user_id: { $exists: true, $type: 'string', $ne: '' },
    });
    logInfo('debug match count', { matchCount });

    if (matchCount === 0) {
      const [recent] = await LogEvent.aggregate([
        { $sort: { timestamp: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, timestamp: 1, timestampType: { $type: '$timestamp' } } },
      ]);

      const recentParsed = recent?.timestamp ? new Date(recent.timestamp) : null;
      const recentParsedIso =
        recentParsed && !Number.isNaN(recentParsed.getTime()) ? recentParsed.toISOString() : null;

      logInfo('debug most recent log', {
        timestamp: recent?.timestamp ?? null,
        timestampType: recent?.timestampType ?? null,
        parsedIso: recentParsedIso,
        nowIso: now.toISOString(),
        skewMs: recentParsedIso ? now.getTime() - recentParsed.getTime() : null,
      });
    }
  }

  const rows = await LogEvent.aggregate([
    {
      $match: {
        timestamp: { $gte: start, $lt: end },
        user_id: { $exists: true, $type: 'string', $ne: '' },
      },
    },
    {
      $project: {
        user_id: 1,
        statusLower: { $toLower: { $ifNull: ['$status', ''] } },
        latency: {
          $convert: {
             input: '$attributes.latency',
            to: 'double',
            onError : null,
            onNull: null,
          },
        },
        ip: '$network.ip',
      },
    },
    {
      $group: {
        _id: {
          user_id: '$user_id',
          timestamp_minute: { $literal: start },
        },
        requests: { $sum: 1 },
        failures: {
          $sum: {
            $cond: [{ $in: ['$statusLower', ['failed', 'error']] }, 1, 0],
          },
        },
        avg_latency: { $avg: '$latency' },
        ips: { $addToSet: '$ip' },
      },
    },
    {
      $project: {
        _id: 0,
        user_id: '$_id.user_id',
        timestamp_minute: '$_id.timestamp_minute',
        requests: 1,
        avg_latency: { $ifNull: ['$avg_latency', 0] },
        error_rate: {
          $cond: [{ $gt: ['$requests', 0] }, { $divide: ['$failures', '$requests'] }, 0],
        },  
        unique_ips: {
          $size: {
            $setDifference: ['$ips', [null, '']],
          },
        },
      },
    },
  ]);

  // Ensure metrics history accumulates even when some minutes have zero logs.
  // This is critical for stable anomaly baselining in low/uneven traffic tenants.
  const activeUserIds = await getActiveUserIds({ now });

  const nowForWrite = new Date();
  const byUser = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.user_id !== 'string' || !r.user_id.trim()) continue;
    const uid = String(r.user_id);
    byUser.set(uid, {
      user_id: uid,
      timestamp_minute: r.timestamp_minute ? new Date(r.timestamp_minute) : start,
      requests: Number(r?.requests ?? 0),
      avg_latency: Number(r?.avg_latency ?? 0),
      error_rate: Number(r?.error_rate ?? 0),
      unique_ips: Number(r?.unique_ips ?? 0),
      updatedAt: nowForWrite,
    });
  }

  // Backfill zero rows for active tenants missing in this minute.
  for (const uid of activeUserIds) {
    if (byUser.has(uid)) continue;
    byUser.set(uid, {
      user_id: uid,
      timestamp_minute: start,
      requests: 0,
      avg_latency: 0,
      error_rate: 0,
      unique_ips: 0,
      updatedAt: nowForWrite,
    });
  }

  const docs = Array.from(byUser.values());

  if (docs.length) {
    await MetricsMinute.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { user_id: doc.user_id, timestamp_minute: start },
          update: { $set: doc, $setOnInsert: { createdAt: nowForWrite } },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    // Backfill prior minutes with zero docs so baseline history is not sparse.
    if (Number.isFinite(MIN_HISTORY_TARGET) && MIN_HISTORY_TARGET > 0) {
      const userIds = docs.map((d) => d.user_id);
      const counts = await MetricsMinute.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: '$user_id', count: { $sum: 1 } } },
      ]).catch(() => []);

      const countByUser = new Map((Array.isArray(counts) ? counts : []).map((r) => [String(r._id), Number(r.count ?? 0)]));

      const backfillOps = [];
      for (const uid of userIds) {
        const have = countByUser.get(uid) ?? 0;
        const need = Math.max(0, MIN_HISTORY_TARGET - have);
        for (let i = 1; i <= need; i += 1) {
          const ts = new Date(start.getTime() - i * ONE_MINUTE_MS);
          backfillOps.push({
            updateOne: {
              filter: { user_id: uid, timestamp_minute: ts },
              update: {
                $setOnInsert: {
                  user_id: uid,
                  timestamp_minute: ts,
                  requests: 0,
                  avg_latency: 0,
                  error_rate: 0,
                  unique_ips: 0,
                  createdAt: nowForWrite,
                  updatedAt: nowForWrite,
                },
              },
              upsert: true,
            },
          });
        }
      }

      if (backfillOps.length) {
        await MetricsMinute.bulkWrite(backfillOps, { ordered: false });
      }
    }
  }

  const durationMs = Date.now() - t0;

  // Cache last computed minute doc for quick reads (TTL 60s)
  await Promise.allSettled(
    docs.map((doc) => safeRedisSet(`anomaly:last_metrics:${doc.user_id}`, JSON.stringify(doc), { ttlSeconds: 60 }))
  );

  logInfo('minute aggregated', {
    timestamp_minute: start.toISOString(),
    tenants: docs.length,
    active_tenants: activeUserIds.length,
    aggregation_time_ms: durationMs,
  });

  return { docs, aggregation_time_ms: durationMs };
}

export function startMetricsMinuteJob({ tickMs = ONE_MINUTE_MS } = {}) {
  let running = false;
  const bootstrapMinutes = Number.isFinite(Number(process.env.METRICS_BOOTSTRAP_MINUTES))
    ? Number(process.env.METRICS_BOOTSTRAP_MINUTES)
    : 15;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await aggregateMinute({});
    } catch (e) {
      logError('tick failed', { message: e?.message, stack: e?.stack });
    } finally {
      running = false;
    }
  }

  // Run soon on startup, then every minute.
  setTimeout(() => {
    (async () => {
      const now = new Date();
      const end = floorToUtcMinute(now);

      if (end && bootstrapMinutes > 0) {
        for (let i = bootstrapMinutes; i >= 1; i -= 1) {
          const minuteStart = new Date(end.getTime() - i * ONE_MINUTE_MS);
          try {
            // eslint-disable-next-line no-await-in-loop
            await aggregateMinute({ minute: minuteStart });
          } catch (e) {
            logError('bootstrap minute failed', { minute: minuteStart.toISOString(), message: e?.message });
          }
        }
      }

      await tick();
    })().catch(() => undefined);
  }, 2_000);
  const id = setInterval(() => {
    tick().catch(() => undefined);
  }, tickMs);

  logInfo('started', { tickMs });

  return {
    stop() {
      clearInterval(id);
      logInfo('stopped');
    },
  };
}
