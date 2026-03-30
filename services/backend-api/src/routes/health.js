import express from 'express';
import mongoose from 'mongoose';
import { ok } from '../lib/apiResponse.js';

export const healthRouter = express.Router();

healthRouter.get('/health', (req, res) => {
  return ok(res, { ok: true });
});

healthRouter.get('/ready', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  return ok(res, { mongo: mongoOk }, { status: mongoOk ? 200 : 503 });
});
