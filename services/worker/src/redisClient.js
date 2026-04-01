import Redis from 'ioredis';

import { config } from './config.js';
import { logger } from './lib/logger.js';

let client = null;
let clientInitError = null;

export function getRedisClient() {
  if (client) return client;
  if (clientInitError) return null;

  const url = config.redisUrl;
  if (!url) return null;

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on('error', (err) => {
      logger.error({ err }, 'redis_client_error');
    });

    return client;
  } catch (e) {
    clientInitError = e;
    logger.error({ err: e }, 'redis_client_init_failed');
    return null;
  }
}

export async function safeRedisGet(key) {
  const c = getRedisClient();
  if (!c) return null;
  try {
    return await c.get(key);
  } catch (e) {
    logger.error({ err: e, key }, 'redis_get_failed');
    return null;
  }
}

export async function safeRedisSet(key, value, { ttlSeconds } = {}) {
  const c = getRedisClient();
  if (!c) return false;

  try {
    if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
      await c.set(key, value, 'EX', ttlSeconds);
    } else {
      await c.set(key, value);
    }
    return true;
  } catch (e) {
    logger.error({ err: e, key }, 'redis_set_failed');
    return false;
  }
}
