import dotenv from 'dotenv';

dotenv.config();

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.BACKEND_PORT ?? 4000),
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  logLevel: process.env.LOG_LEVEL ?? ((process.env.NODE_ENV ?? 'development') === 'production' ? 'info' : 'debug'),
  logPretty: String(process.env.LOG_PRETTY ?? '1') !== '0',
  logTtlSeconds: Number(process.env.LOG_TTL_SECONDS ?? 86_400),
  metricsTtlSeconds: Number(process.env.METRICS_TTL_SECONDS ?? 604_800),
  mongoUrl: process.env.MONGO_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  corsOrigins: parseCsv(process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),

  aiEngineUrl: process.env.AI_ENGINE_URL ?? '',

  copilotProvider: process.env.COPILOT_PROVIDER ?? 'mock',
  // Grok (xAI) only.
  // Preferred: XAI_*. Back-compat: GROK_*.
  // Also accept OPENAI_API_KEY as a common deployment alias.
  xaiApiKey: process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? process.env.OPENAI_API_KEY,
  xaiModel: process.env.XAI_MODEL ?? process.env.GROK_MODEL ?? 'grok-2-latest',
  copilotRateLimitPerMinute: Number(process.env.COPILOT_RATE_LIMIT_PER_MINUTE ?? 10),

  internalBroadcastSecret: process.env.INTERNAL_BROADCAST_SECRET ?? '',
};

export function requireEnv() {
  const missing = [];
  for (const key of ['MONGO_URL', 'REDIS_URL', 'JWT_SECRET']) {
    if (!process.env[key]) missing.push(key);
  }

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    if (!process.env.INTERNAL_BROADCAST_SECRET) missing.push('INTERNAL_BROADCAST_SECRET');
  }

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }
}
