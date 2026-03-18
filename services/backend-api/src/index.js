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
import { copilotRouter } from './routes/copilot.js';

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
app.use('/api/auth', authRouter);

// Protect everything else
app.use('/api', requireAuth);

app.use('/api/logs', createLogsRouter(analysisQueue));

// Alerts
app.use('/api/alerts', alertsRouter);

// Copilot
app.use('/api/copilot', copilotRouter);

app.use(errorHandler);

// Start server
app.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`backend-api listening on :${config.port}`);
});
