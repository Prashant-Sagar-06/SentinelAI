import express from 'express';
import mongoose from 'mongoose';
import { ok } from '../lib/apiResponse.js';

export const healthRouter = express.Router();

healthRouter.get('/health', async (req, res) => {
  try {
    const mongoReadyState = mongoose.connection.readyState;
    if (mongoReadyState !== 1) {
      return ok(res, { status: 'error', service: 'backend', mongo: 'down' }, { status: 503 });
    }

    await mongoose.connection.db.admin().ping();

    const analysisQueue = req.app.get('analysisQueue');
    if (!analysisQueue) {
      return ok(res, { status: 'error', service: 'backend', mongo: 'connected', redis: 'down' }, { status: 503 });
    }

    await analysisQueue.waitUntilReady();
    const client = await analysisQueue.client;
    const pong = await client.ping();
    if (pong !== 'PONG') {
      return ok(res, { status: 'error', service: 'backend', mongo: 'connected', redis: 'down' }, { status: 503 });
    }

    return ok(res, { status: 'ok', service: 'backend', mongo: 'connected', redis: 'connected' });
  } catch (err) {
    return ok(res, { status: 'error', service: 'backend', message: err?.message || 'health_check_failed' }, { status: 503 });
  }
});

healthRouter.get('/ready', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  return ok(res, { mongo: mongoOk }, { status: mongoOk ? 200 : 503 });
});
