import dotenv from 'dotenv';
import net from 'node:net';
import { z } from 'zod';

dotenv.config();

function isLocalOrPrivateHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;
  if (host === '0.0.0.0') return true;
  const ipKind = net.isIP(host);
  if (ipKind === 4) {
    const [a, b] = host.split('.').map((p) => Number(p));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (ipKind === 6) {
    if (host === '::1') return true;
    if (host.startsWith('fc') || host.startsWith('fd')) return true;
    if (host.startsWith('fe80')) return true;
    return false;
  }
  if (!host.includes('.')) return true;
  return false;
}

function parsePublicBaseUrl(name, raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error(`${name} must be a valid URL (e.g. https://api.domain.com)`);
  }
  if (u.protocol !== 'https:') throw new Error(`${name} must use https://`);
  if (isLocalOrPrivateHost(u.hostname)) {
    throw new Error(`${name} must point to a public host`);
  }
  return u.toString().replace(/\/$/, '');
}

function parseRedisTlsUrl(raw) {
  const s = String(raw);
  if (!s.startsWith('rediss://')) {
    throw new Error('REDIS_URL must use TLS (rediss://...)');
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('REDIS_URL must be a valid URL');
  }
  if (isLocalOrPrivateHost(u.hostname)) {
    throw new Error('REDIS_URL must point to a public host');
  }
  return s;
}

function parseAtlasMongoUrl(raw) {
  const s = String(raw);
  if (!s.startsWith('mongodb+srv://')) {
    throw new Error('MONGO_URL must be a MongoDB Atlas SRV URL (mongodb+srv://...)');
  }
  const host = String(s.split('@')[1] ?? '').split('/')[0].split('?')[0].split(':')[0].trim();
  if (!host || isLocalOrPrivateHost(host)) {
    throw new Error('MONGO_URL must point to a public Atlas host');
  }
  return s;
}

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  LOG_PRETTY: z.string().optional(),
  WORKER_HEARTBEAT_INTERVAL_MS: z.string().optional(),
  LOG_TTL_SECONDS: z.string().optional(),
  METRICS_TTL_SECONDS: z.string().optional(),
  AI_ENGINE_TIMEOUT_MS: z.string().optional(),
  ALERT_THRESHOLD_RISK: z.string().optional(),
  MIN_METRICS_HISTORY_FOR_ANOMALY: z.string().optional(),

  MONGO_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AI_ENGINE_URL: z.string().min(1),
  BACKEND_API_URL: z.string().min(1),
  INTERNAL_BROADCAST_SECRET: z.string().min(1),
});

let parsedEnv;

function loadEnv() {
  if (parsedEnv) return parsedEnv;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  const env = result.data;
  parsedEnv = {
    nodeEnv: env.NODE_ENV ?? 'production',
    logLevel: env.LOG_LEVEL ?? 'info',
    logPretty: env.LOG_PRETTY ? String(env.LOG_PRETTY) !== '0' : false,
    heartbeatIntervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS ? Number(env.WORKER_HEARTBEAT_INTERVAL_MS) : 30_000,
    logTtlSeconds: env.LOG_TTL_SECONDS ? Number(env.LOG_TTL_SECONDS) : 86_400,
    metricsTtlSeconds: env.METRICS_TTL_SECONDS ? Number(env.METRICS_TTL_SECONDS) : 604_800,
    mongoUrl: parseAtlasMongoUrl(env.MONGO_URL),
    redisUrl: parseRedisTlsUrl(env.REDIS_URL),
    aiEngineUrl: parsePublicBaseUrl('AI_ENGINE_URL', env.AI_ENGINE_URL),
    aiEngineTimeoutMs: env.AI_ENGINE_TIMEOUT_MS ? Number(env.AI_ENGINE_TIMEOUT_MS) : 8000,
    alertThresholdRisk: env.ALERT_THRESHOLD_RISK ? Number(env.ALERT_THRESHOLD_RISK) : 0.6,
    minMetricsHistoryForAnomaly: env.MIN_METRICS_HISTORY_FOR_ANOMALY ? Number(env.MIN_METRICS_HISTORY_FOR_ANOMALY) : 10,
    backendApiUrl: parsePublicBaseUrl('BACKEND_API_URL', env.BACKEND_API_URL),
    internalBroadcastSecret: env.INTERNAL_BROADCAST_SECRET,
  };
  return parsedEnv;
}

export const config = loadEnv();

export function requireEnv() {
  return loadEnv();
}
