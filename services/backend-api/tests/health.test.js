import test from 'node:test';
import assert from 'node:assert/strict';

import express from 'express';
import request from 'supertest';

import { healthRouter } from '../src/routes/health.js';

test('GET /health returns ok', async () => {
  const app = express();
  app.use(healthRouter);

  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { data: { ok: true }, error: null });
});
