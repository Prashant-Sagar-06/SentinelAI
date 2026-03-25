import { fail } from '../lib/apiResponse.js';

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return fail(res, { status: 401, code: 'missing_user', message: 'Missing user' });
    if (!allowedRoles.includes(role)) return fail(res, { status: 403, code: 'forbidden', message: 'Forbidden' });
    return next();
  };
}
