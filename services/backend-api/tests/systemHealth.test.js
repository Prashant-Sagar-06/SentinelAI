import test from 'node:test';
import assert from 'node:assert/strict';

import express from 'express';
import request from 'supertest';

import { createSystemHealthRouter } from '../src/routes/systemHealth.js';

function buildQueueStub() {
  return {
    waitUntilReady: async () => {},
    client: Promise.resolve({ ping: async () => 'PONG' }),
    getJobCounts: async () => ({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
  };
}

test('GET /api/system-health returns structured payload', async () => {
  // Do not rely on real Mongo/AI engine in unit tests.
  delete process.env.AI_ENGINE_URL;

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

  // AI engine is not configured in this test.
  assert.equal(res.body.data.ai_engine.urlConfigured, false);
});
