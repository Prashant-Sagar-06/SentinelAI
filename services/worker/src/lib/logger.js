import pino from 'pino';

import { config } from '../config.js';

function buildTransport() {
  if ((process.env.NODE_ENV ?? 'development') === 'production') return undefined;
  if (!config.logPretty) return undefined;

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino({
  level: config.logLevel,
  transport: buildTransport(),
});
