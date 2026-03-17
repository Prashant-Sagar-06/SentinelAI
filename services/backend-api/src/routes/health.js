import express from 'express';
import mongoose from 'mongoose';

export const healthRouter = express.Router();

healthRouter.get('/health', (req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/ready', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  res.status(mongoOk ? 200 : 503).json({ mongo: mongoOk });
});
