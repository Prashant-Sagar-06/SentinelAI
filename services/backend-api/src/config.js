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
};

export function requireEnv() {
  const missing = [];
  for (const key of ['MONGO_URL', 'REDIS_URL', 'JWT_SECRET']) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }
}
