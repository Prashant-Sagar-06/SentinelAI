import { createLogger, format, transports } from 'winston';

import { config } from '../config.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error);
}

function normalizeError(err) {
  if (!(err instanceof Error)) return err;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err.code ? { code: err.code } : {}),
  };
}

function normalizeMeta(meta) {
  if (!isPlainObject(meta)) return undefined;
  const out = { ...meta };
  if ('err' in out) out.err = normalizeError(out.err);
  if ('error' in out) out.error = normalizeError(out.error);
  return out;
}

function normalizeArgs(args) {
  if (!args || args.length === 0) return { message: '', meta: undefined };

  const [a, b] = args;
  if (typeof a === 'string') return { message: a, meta: undefined };
  if (a instanceof Error) {
    return {
      message: typeof b === 'string' && b.trim() ? b : a.message,
      meta: { err: normalizeError(a) },
    };
  }
  if (isPlainObject(a)) {
    return {
      message: typeof b === 'string' ? b : '',
      meta: normalizeMeta(a),
    };
  }

  return { message: String(a), meta: undefined };
}

const baseLogger = createLogger({
  level: (config.logLevel ?? 'info').toLowerCase(),
  defaultMeta: {
    service: 'worker',
    env: config.nodeEnv,
  },
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()],
});

function makeMethod(level) {
  return (...args) => {
    const { message, meta } = normalizeArgs(args);
    baseLogger.log(level, message, meta);
  };
}

export const logger = {
  error: makeMethod('error'),
  warn: makeMethod('warn'),
  info: makeMethod('info'),
  debug: makeMethod('debug'),
};
