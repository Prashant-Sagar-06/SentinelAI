import Redis from 'ioredis';

import { config } from './config.js';

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
      // eslint-disable-next-line no-console
      console.error('[redis] client error', { message: err?.message });
    });

    return client;
  } catch (e) {
    clientInitError = e;
    // eslint-disable-next-line no-console
    console.error('[redis] client init failed', { message: e?.message });
    return null;
  }
}

export async function safeRedisGet(key) {
  const c = getRedisClient();
  if (!c) return null;
  try {
    return await c.get(key);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[redis] GET failed', { key, message: e?.message });
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
    // eslint-disable-next-line no-console
    console.error('[redis] SET failed', { key, message: e?.message });
    return false;
  }
}
