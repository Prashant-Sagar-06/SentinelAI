import { AnomalyBaseline } from '../models/AnomalyBaseline.js';
import { safeRedisGet, safeRedisSet } from '../redisClient.js';
import { logger } from '../lib/logger.js';

const CACHE_TTL_MS = 60_000;

function logInfo(message, meta) {
  logger.info({ component: 'baseline', ...(meta ?? {}) }, message);
}

function logError(message, meta) {
  logger.error({ component: 'baseline', ...(meta ?? {}) }, message);
}

const memCache = new Map();

function cacheGet(key) {
  const v = memCache.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return v.value;
}

function cacheSet(key, value) {
  memCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export const BASELINE_KEYS = {
  requests: 'anomaly:baseline:requests',
  latency: 'anomaly:baseline:latency',
  error_rate: 'anomaly:baseline:error_rate',
  unique_ips: 'anomaly:baseline:unique_ips',
};

export async function getBaseline(key) {
  const cached = cacheGet(key);
  if (cached) return cached;

  // Preferred: Redis (persistent baseline)
  const raw = await safeRedisGet(key);
  if (raw) {
    const parsed = safeJsonParse(raw);
    if (parsed && typeof parsed.mean === 'number' && typeof parsed.std === 'number') {
      const value = {
        mean: parsed.mean,
        std: parsed.std,
        n: typeof parsed.n === 'number' ? parsed.n : null,
        last_updated: parsed.last_updated ? new Date(parsed.last_updated) : new Date(),
        source: 'redis',
      };
      cacheSet(key, value);
      return value;
    }
  }

  // Fallback: Mongo
  try {
    const doc = await AnomalyBaseline.findOne({ key }).select({ mean: 1, std: 1, n: 1, last_updated: 1 }).lean();
    if (doc) {
      const value = {
        mean: Number(doc.mean),
        std: Number(doc.std),
        n: typeof doc.n === 'number' ? doc.n : null,
        last_updated: doc.last_updated ? new Date(doc.last_updated) : new Date(),
        source: 'mongo',
      };
      cacheSet(key, value);
      return value;
    }
  } catch (e) {
    logError('mongo read failed', { key, message: e?.message });
  }

  return null;
}

export async function setBaseline(key, { mean, std, n = null, last_updated = new Date() }) {
  const payload = JSON.stringify({ mean, std, n, last_updated: new Date(last_updated).toISOString() });

  // Best-effort Redis write (no TTL: baseline should survive restarts)
  const okRedis = await safeRedisSet(key, payload);

  // Always attempt Mongo upsert as fallback source of truth.
  try {
    await AnomalyBaseline.updateOne(
      { key },
      {
        $set: {
          mean: Number(mean),
          std: Number(std),
          n: typeof n === 'number' ? n : null,
          last_updated: new Date(last_updated),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (e) {
    logError('mongo upsert failed', { key, message: e?.message });
  }

  const value = {
    mean: Number(mean),
    std: Number(std),
    n: typeof n === 'number' ? n : null,
    last_updated: new Date(last_updated),
    source: okRedis ? 'redis' : 'mongo',
  };
  cacheSet(key, value);

  logInfo('baseline updated', { key, mean: value.mean, std: value.std, n: value.n, source: value.source });
  return value;
}
