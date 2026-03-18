import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mongoUrl: process.env.MONGO_URL,
  redisUrl: process.env.REDIS_URL,
  aiEngineUrl: process.env.AI_ENGINE_URL ?? 'http://ai-engine:8000',
  alertThresholdRisk: Number(process.env.ALERT_THRESHOLD_RISK ?? 0.6),
  backendApiUrl: process.env.BACKEND_API_URL ?? 'http://backend-api:4000',
  internalBroadcastSecret: process.env.INTERNAL_BROADCAST_SECRET ?? '',
};

export function requireEnv() {
  const missing = [];
  for (const key of ['MONGO_URL', 'REDIS_URL', 'AI_ENGINE_URL']) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
