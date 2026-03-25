import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { fail } from '../lib/apiResponse.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(res, { status: 401, code: 'missing_token', message: 'Missing token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return fail(res, { status: 401, code: 'invalid_token', message: 'Invalid token' });
  }
}

export function signJwt(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '12h' }
  );
}
