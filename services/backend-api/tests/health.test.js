import test from 'node:test';
import assert from 'node:assert/strict';

import express from 'express';
import request from 'supertest';

import { healthRouter } from '../src/routes/health.js';

test('GET /health returns ok', async () => {
  const app = express();
  app.use(healthRouter);

  const res = await request(app).get('/health');
  // Without Mongo/Redis connected in unit tests, health is degraded.
  assert.equal(res.status, 503);
  assert.equal(res.body?.data?.service, 'backend');
});
