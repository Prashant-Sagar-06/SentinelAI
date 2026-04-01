import test from 'node:test';
import assert from 'node:assert/strict';

import express from 'express';
import request from 'supertest';

function buildQueueStub() {
  return {
    waitUntilReady: async () => {},
    client: Promise.resolve({ ping: async () => 'PONG' }),
    getJobCounts: async () => ({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
  };
}

test('GET /api/system-health returns structured payload', async () => {
  // Strict env validation: provide required public-looking env values.
  // Do not rely on real Mongo/AI engine in unit tests.
  process.env.PORT = process.env.PORT || '4000';
  process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://user:pass@cluster.example.com/sentinelai?retryWrites=true&w=majority';
  process.env.REDIS_URL = process.env.REDIS_URL || 'rediss://:pass@redis.example.com:6379';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
  process.env.INTERNAL_BROADCAST_SECRET = process.env.INTERNAL_BROADCAST_SECRET || 'test_internal_secret';
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://app.example.com';
  process.env.AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'https://ai.example.com';

  const { createSystemHealthRouter } = await import('../src/routes/systemHealth.js');

  const app = express();
  app.use('/api/system-health', createSystemHealthRouter(buildQueueStub()));

  const res = await request(app).get('/api/system-health');

  // Without a real Mongo connection and AI engine, overall should be degraded.
  assert.equal(res.status, 503);
  assert.equal(typeof res.body?.data?.ok, 'boolean');

  for (const key of ['backend', 'mongo', 'redis', 'worker', 'ai_engine']) {
    assert.ok(res.body?.data?.[key], `missing ${key}`);
    assert.equal(typeof res.body.data[key].status, 'string');
  }

  // Redis/worker checks should still pass via the stub.
  assert.equal(res.body.data.redis.status, 'ok');
  assert.equal(res.body.data.worker.status, 'ok');

  // AI engine URL is configured, but health check will likely fail in unit tests.
  assert.equal(res.body.data.ai_engine.urlConfigured, true);
});
