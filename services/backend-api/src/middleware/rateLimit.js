import rateLimit from 'express-rate-limit';

import { config } from '../config.js';
import { tooManyRequests } from '../lib/httpError.js';

export function createRateLimiter({ windowMs, limit, keyGenerator, code = 'rate_limited' }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res, next, options) => {
      next(
        tooManyRequests(code, 'Too many requests', {
          windowMs: options.windowMs,
          limit: options.limit,
        })
      );
    },
  });
}

export const apiLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: config.rateLimitPerMinute,
});

export const copilotLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: config.copilotRateLimitPerMinute,
  keyGenerator: (req) => req.user?.sub ?? req.ip,
  code: 'copilot_rate_limited',
});
