import dotenv from 'dotenv';

dotenv.config();

export const config = {
  logLevel: process.env.LOG_LEVEL ?? ((process.env.NODE_ENV ?? 'development') === 'production' ? 'info' : 'debug'),
  logPretty: String(process.env.LOG_PRETTY ?? '1') !== '0',
  heartbeatIntervalMs: Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 30_000),
  logTtlSeconds: Number(process.env.LOG_TTL_SECONDS ?? 86_400),
  metricsTtlSeconds: Number(process.env.METRICS_TTL_SECONDS ?? 604_800),
  mongoUrl: process.env.MONGO_URL,
  redisUrl: process.env.REDIS_URL,
  aiEngineUrl: process.env.AI_ENGINE_URL,
  aiEngineTimeoutMs: Number(process.env.AI_ENGINE_TIMEOUT_MS ?? 4500),
  alertThresholdRisk: Number(process.env.ALERT_THRESHOLD_RISK ?? 0.6),
  minMetricsHistoryForAnomaly: Number(process.env.MIN_METRICS_HISTORY_FOR_ANOMALY ?? 10),
  backendApiUrl: process.env.BACKEND_API_URL,
  internalBroadcastSecret: process.env.INTERNAL_BROADCAST_SECRET ?? '',
};

export function requireEnv() {
  const missing = [];
  for (const key of ['MONGO_URL', 'REDIS_URL', 'AI_ENGINE_URL', 'BACKEND_API_URL']) {
    if (!process.env[key]) missing.push(key);
  }
  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    if (!process.env.INTERNAL_BROADCAST_SECRET) missing.push('INTERNAL_BROADCAST_SECRET');
  }
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
