import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config, requireEnv } from './config.js';
import { connectMongo } from './db.js';
import { createAnalysisQueue } from './queue.js';
import { errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { createLogsRouter } from './routes/logs.js';
import { alertsRouter } from './routes/alerts.js';
import { anomaliesRouter } from './routes/anomalies.js';
import { copilotRouter } from './routes/copilot.js';
import { incidentsRouter } from './routes/incidents.js';
import { attackMapRouter } from './routes/attackMap.js';
import { createSystemHealthRouter } from './routes/systemHealth.js';
import { metricsRouter } from './routes/metrics.js';
import { responsesRouter } from './routes/responses.js';
import { initSocket, broadcastAlert } from './lib/socket.js';

requireEnv();
await connectMongo();

const analysisQueue = createAnalysisQueue();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: false,
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: config.rateLimitPerMinute,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.use(healthRouter);

// Worker/internal hooks (no JWT)
app.post('/internal/broadcast/alert', async (req, res) => {
  const secret = config.internalBroadcastSecret;
  if (!secret) return res.status(503).json({ error: 'internal_broadcast_disabled' });
  const provided = String(req.header('x-internal-secret') ?? '');
  if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });

  // Keep it permissive; worker may send partial shapes.
  const alert = req.body;
  if (!alert || typeof alert !== 'object') return res.status(400).json({ error: 'invalid_body' });

  broadcastAlert(alert);
  return res.json({ ok: true });
});

app.use('/api/auth', authRouter);

// Protect everything else
app.use('/api', requireAuth);

app.use('/api/logs', createLogsRouter(analysisQueue));

// Alerts
app.use('/api/alerts', alertsRouter);

// Anomalies
app.use('/api/anomalies', anomaliesRouter);

// Incidents
app.use('/api/incidents', incidentsRouter);

// Attack map
app.use('/api/attack-map', attackMapRouter);

// System health
app.use('/api/system-health', createSystemHealthRouter(analysisQueue));

// Metrics
app.use('/api/metrics', metricsRouter);

// Auto-responses
app.use('/api/responses', responsesRouter);

// Copilot
app.use('/api/copilot', copilotRouter);

app.use(errorHandler);

// Start server (http server required for Socket.IO)
const server = http.createServer(app);
initSocket(server);

server.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`backend-api listening on :${config.port}`);
});
