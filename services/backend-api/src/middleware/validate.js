import { ZodError } from 'zod';

import { badRequest } from '../lib/httpError.js';

export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(badRequest('invalid_request', 'Request validation failed', err.flatten()));
      }
      return next(err);
    }
  };
}

export function validateBody(schema) {
  return validate({ body: schema });
}

export function validateQuery(schema) {
  return validate({ query: schema });
}

export function validateParams(schema) {
  return validate({ params: schema });
}
