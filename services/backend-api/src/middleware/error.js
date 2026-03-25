import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../lib/httpError.js';
import { fail } from '../lib/apiResponse.js';

function toPublicMessage(statusCode, err) {
  if (statusCode >= 500 && config.nodeEnv === 'production') return 'Internal server error';
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return statusCode >= 500 ? 'Internal server error' : 'Request failed';
}

function normalizeError(err) {
  if (err instanceof HttpError) {
    return {
      statusCode: err.statusCode,
      code: err.code ?? 'request_error',
      details: err.details,
      expose: err.expose,
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'invalid_request',
      details: err.flatten(),
      expose: true,
    };
  }

  // Mongoose validation / cast errors
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      code: 'invalid_request',
      details: err.errors,
      expose: true,
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: 'invalid_request',
      details: { path: err.path, value: err.value },
      expose: true,
    };
  }

  // Duplicate key
  if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
    return {
      statusCode: 409,
      code: 'conflict',
      details: err.keyValue ?? undefined,
      expose: true,
    };
  }

  // Generic fallback
  return {
    statusCode: err?.statusCode ?? err?.status ?? 500,
    code: err?.code ?? 'server_error',
    details: err?.details,
    expose: false,
  };
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const requestId = req.id;
  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode ?? 500;

  const publicMessage = toPublicMessage(statusCode, err);

  const log = req.log ?? logger;
  const logPayload = { err, requestId, statusCode };

  if (statusCode >= 500) log.error(logPayload, 'request_failed');
  else log.warn(logPayload, 'request_failed');

  return fail(res, {
    status: statusCode,
    code: normalized.code ?? 'server_error',
    message: publicMessage,
    details: normalized.details,
    requestId,
  });
}
