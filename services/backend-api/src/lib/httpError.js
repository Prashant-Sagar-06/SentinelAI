export class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = statusCode >= 400 && statusCode < 500;
  }
}

export function badRequest(code, message, details) {
  return new HttpError(400, code, message, details);
}

export function unauthorized(code, message, details) {
  return new HttpError(401, code, message, details);
}

export function forbidden(code, message, details) {
  return new HttpError(403, code, message, details);
}

export function notFound(code, message, details) {
  return new HttpError(404, code, message, details);
}

export function tooManyRequests(code, message, details) {
  return new HttpError(429, code, message, details);
}
