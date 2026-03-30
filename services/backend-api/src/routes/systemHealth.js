import express from 'express';
import mongoose from 'mongoose';

import { config } from '../config.js';
import { ok as okResponse } from '../lib/apiResponse.js';

export function createSystemHealthRouter(analysisQueue) {
  const router = express.Router();

  function status(ok) {
    return ok ? 'ok' : 'down';
  }

  async function withTimeout(ms, fn) {
    let timeoutId;
    const started = Date.now();

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ ok: false, timedOut: true, ms: Date.now() - started }), ms);
    });

    const opPromise = (async () => {
      await fn();
      return { ok: true, timedOut: false, ms: Date.now() - started };
    })().catch((err) => ({ ok: false, timedOut: false, ms: Date.now() - started, error: err?.message }));

    try {
      return await Promise.race([opPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  router.get('/', async (req, res) => {
    const backend = { status: 'ok', uptime_s: Math.round(process.uptime()) };

    const mongoReadyState = mongoose.connection.readyState;
    const mongo = { status: status(mongoReadyState === 1), readyState: mongoReadyState };

    const redisPromise = withTimeout(2000, async () => {
      if (!analysisQueue) throw new Error('missing_queue');
      await analysisQueue.waitUntilReady();
      const client = await analysisQueue.client;
      const pong = await client.ping();
      if (pong !== 'PONG') throw new Error('bad_pong');
    });

    const workerPromise = withTimeout(2000, async () => {
      if (!analysisQueue) throw new Error('missing_queue');
      await analysisQueue.waitUntilReady();
      await analysisQueue.getJobCounts('waiting', 'active', 'failed');
    });

    const aiEngineBase = config.aiEngineUrl ? config.aiEngineUrl.replace(/\/$/, '') : '';
    const aiEnginePromise = withTimeout(5000, async () => {
      if (!aiEngineBase) throw new Error('missing_ai_engine_url');
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4500);
      try {
        const r = await fetch(`${aiEngineBase}/health`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!r.ok) throw new Error('bad_status');
        const json = await r.json().catch(() => null);
        if (!json || json.ok !== true) throw new Error('bad_body');
      } finally {
        clearTimeout(t);
      }
    });

    const [redisResult, workerResult, aiEngineResult] = await Promise.all([
      redisPromise,
      workerPromise,
      aiEnginePromise,
    ]);

    const redis = {
      status: status(redisResult.ok),
      timedOut: redisResult.timedOut,
      latency_ms: redisResult.ms,
      ...(redisResult.error ? { error: redisResult.error } : {}),
    };
    const worker = {
      status: status(workerResult.ok),
      timedOut: workerResult.timedOut,
      latency_ms: workerResult.ms,
      ...(workerResult.error ? { error: workerResult.error } : {}),
    };
    const ai_engine = {
      status: status(aiEngineResult.ok),
      timedOut: aiEngineResult.timedOut,
      latency_ms: aiEngineResult.ms,
      ...(aiEngineResult.error ? { error: aiEngineResult.error } : {}),
      urlConfigured: Boolean(aiEngineBase),
    };

    const ok = [backend, mongo, redis, worker, ai_engine].every((c) => c.status === 'ok');
    return okResponse(res, { ok, ts: new Date().toISOString(), backend, mongo, redis, worker, ai_engine }, { status: ok ? 200 : 503 });
  });

  return router;
}
