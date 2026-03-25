import pino from 'pino';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';

import { config } from '../config.js';

function buildTransport() {
  if (config.nodeEnv === 'production') return undefined;
  if (!config.logPretty) return undefined;

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  };
}

export const logger = pino({
  level: config.logLevel,
  transport: buildTransport(),
  redact: {
    paths: ['req.headers.authorization'],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const header = req.headers['x-request-id'];
    const incoming = Array.isArray(header) ? header[0] : header;
    const id = incoming && String(incoming).trim() ? String(incoming).trim() : nanoid(12);
    res.setHeader('x-request-id', id);
    return id;
  },
  customProps: (req) => ({
    requestId: req.id,
    userId: req.user?.sub,
  }),
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/ready',
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
