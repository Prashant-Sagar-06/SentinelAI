import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config, requireEnv } from './config.js';
import { connectMongo } from './db.js';
import { createAnalysisQueue } from './queue.js';
import { errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { httpLogger, logger } from './lib/logger.js';
import { ok, fail } from './lib/apiResponse.js';

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

import { LogEvent } from './models/LogEvent.js';
import { MetricsMinute } from './models/MetricsMinute.js';
import { Response } from './models/Response.js';
import { Alert } from './models/Alert.js';
import { Anomaly } from './models/Anomaly.js';
import { AnomalyResult } from './models/AnomalyResult.js';
import { Incident } from './models/Incident.js';

// -------------------- INIT --------------------
requireEnv();

try {
  await connectMongo();
} catch (err) {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
}

// Ensure indexes
await Promise.allSettled([
  LogEvent.syncIndexes(),
  MetricsMinute.syncIndexes(),
  Alert.syncIndexes(),
  Anomaly.syncIndexes(),
  AnomalyResult.syncIndexes(),
  Incident.syncIndexes(),
  Response.syncIndexes(),
]);

const analysisQueue = createAnalysisQueue();

// -------------------- APP --------------------
const app = express();

app.set('trust proxy', config.trustProxy);
app.set('analysisQueue', analysisQueue);

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(httpLogger);
app.use(express.json({ limit: '2mb' }));

// -------------------- REQUEST TIMEOUT --------------------
app.use((req, res, next) => {
  res.setTimeout(10_000, () => {
    if (res.headersSent) return;
    return res.status(408).send('Request Timeout');
  });
  next();
});

// -------------------- CORS --------------------
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = origin === config.corsOrigin;
      return cb(allowed ? null : new Error('CORS origin not allowed'), allowed);
    },
    credentials: true,
  })
);

// -------------------- HEALTH --------------------
app.use(healthRouter);

// -------------------- ROOT --------------------
app.get('/', (req, res) => {
  return ok(res, { status: 'SentinelAI backend running' });
});

// -------------------- RATE LIMIT --------------------
app.use(apiLimiter);

// -------------------- INTERNAL --------------------
app.post('/internal/broadcast/alert', async (req, res) => {
  const provided = String(req.header('x-internal-secret') ?? '');

  if (provided !== config.internalBroadcastSecret) {
    return fail(res, { status: 401, code: 'unauthorized', message: 'Unauthorized' });
  }

  const alert = req.body;

  if (!alert || typeof alert !== 'object') {
    return fail(res, { status: 400, code: 'invalid_body', message: 'Invalid body' });
  }

  broadcastAlert(alert);
  return ok(res, { ok: true });
});

// -------------------- AUTH --------------------
app.use('/api/auth', authRouter);

// -------------------- PROTECTED --------------------
app.use('/api', requireAuth);

// -------------------- ROUTES --------------------
app.use('/api/logs', createLogsRouter());
app.use('/api/alerts', alertsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/attack-map', attackMapRouter);
app.use('/api/system-health', createSystemHealthRouter(analysisQueue));
app.use('/api/metrics', metricsRouter);
app.use('/api/responses', responsesRouter);
app.use('/api/copilot', copilotRouter);

// -------------------- ERROR HANDLER --------------------
app.use(errorHandler);

// -------------------- SERVER --------------------
const server = http.createServer(app);

initSocket(server);

server.listen(config.port, '0.0.0.0', () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    'backend-api listening'
  );
});

// -------------------- GRACEFUL SHUTDOWN --------------------
async function shutdown(signal) {
  logger.info({ signal }, 'shutdown_start');

  try {
    await analysisQueue.close();
    server.close(() => {
      logger.info('http server closed');
    });
  } catch (err) {
    logger.error({ err }, 'shutdown_error');
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// -------------------- GLOBAL ERROR HANDLING --------------------
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});