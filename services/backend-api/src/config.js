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

  // Public DNS names should have at least one dot.
  // This rejects internal docker-style hostnames like "ai-engine".
  if (!host.includes('.')) return true;
  return false;
}

function parseOrigin(name, raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error(`${name} must be a valid URL origin (e.g. https://app.domain.com)`);
  }
  if (!['https:'].includes(u.protocol)) {
    throw new Error(`${name} must use https://`);
  }
  if (u.username || u.password) {
    throw new Error(`${name} must not contain credentials`);
  }
  if (u.pathname !== '/' || u.search || u.hash) {
    throw new Error(`${name} must be an origin only (no path/query/hash)`);
  }
  if (isLocalOrPrivateHost(u.hostname)) {
    throw new Error(`${name} must point to a public host`);
  }
  return u.origin;
}

function parsePublicBaseUrl(name, raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error(`${name} must be a valid URL (e.g. https://api.domain.com)`);
  }
  if (!['https:'].includes(u.protocol)) {
    throw new Error(`${name} must use https://`);
  }
  if (isLocalOrPrivateHost(u.hostname)) {
    throw new Error(`${name} must point to a public host`);
  }
  return u.toString().replace(/\/$/, '');
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

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().min(1),
  TRUST_PROXY: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  LOG_PRETTY: z.string().optional(),
  LOG_TTL_SECONDS: z.string().optional(),
  METRICS_TTL_SECONDS: z.string().optional(),
  RATE_LIMIT_PER_MINUTE: z.string().optional(),

  MONGO_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  AI_ENGINE_URL: z.string().min(1),
  INTERNAL_BROADCAST_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),

  COPILOT_PROVIDER: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  XAI_MODEL: z.string().optional(),
  COPILOT_RATE_LIMIT_PER_MINUTE: z.string().optional(),
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

  const config = {
    nodeEnv: env.NODE_ENV ?? 'production',
    port: Number(env.PORT),
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : 1,
    logLevel: env.LOG_LEVEL ?? 'info',
    logPretty: env.LOG_PRETTY ? String(env.LOG_PRETTY) !== '0' : false,
    logTtlSeconds: env.LOG_TTL_SECONDS ? Number(env.LOG_TTL_SECONDS) : 86_400,
    metricsTtlSeconds: env.METRICS_TTL_SECONDS ? Number(env.METRICS_TTL_SECONDS) : 604_800,
    mongoUrl: parseAtlasMongoUrl(env.MONGO_URL),
    redisUrl: parseRedisTlsUrl(env.REDIS_URL),
    jwtSecret: env.JWT_SECRET,
    corsOrigin: parseOrigin('CORS_ORIGIN', env.CORS_ORIGIN),
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE ? Number(env.RATE_LIMIT_PER_MINUTE) : 120,
    aiEngineUrl: parsePublicBaseUrl('AI_ENGINE_URL', env.AI_ENGINE_URL),
    internalBroadcastSecret: env.INTERNAL_BROADCAST_SECRET,
    copilotProvider: env.COPILOT_PROVIDER ?? null,
    xaiApiKey: env.XAI_API_KEY ?? null,
    xaiModel: env.XAI_MODEL ?? null,
    copilotRateLimitPerMinute: env.COPILOT_RATE_LIMIT_PER_MINUTE ? Number(env.COPILOT_RATE_LIMIT_PER_MINUTE) : 10,
  };

  if (!Number.isFinite(config.port) || config.port <= 0) {
    throw new Error('PORT must be a valid number');
  }

  parsedEnv = config;
  return parsedEnv;
}

export const config = loadEnv();

export function requireEnv() {
  // Force load/validation at startup.
  return loadEnv();
}
