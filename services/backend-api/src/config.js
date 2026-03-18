import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.BACKEND_PORT ?? 4000),
  mongoUrl: process.env.MONGO_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),

  copilotProvider: process.env.COPILOT_PROVIDER ?? 'mock',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL ?? 'llama3-70b-8192',
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
