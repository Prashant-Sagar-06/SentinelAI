import express from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { signJwt, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ok } from '../lib/apiResponse.js';
import { HttpError, unauthorized } from '../lib/httpError.js';

export const authRouter = express.Router();

/* =========================
   REGISTER
========================= */
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'analyst', 'viewer']).optional(),
});

authRouter.post('/register', validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return next(new HttpError(409, 'email_in_use', 'Email already registered'));
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      passwordHash, // ✅ correct field
      role: role ?? 'analyst',
    });

    const token = signJwt(user);

    return ok(res, {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
   LOGIN
========================= */
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ✅ Fetch both fields (for safety)
    const user = await User.findOne({ email }).select('+passwordHash +password');

    // ❗ Handle both schema cases
    const storedHash = user?.passwordHash || user?.password;

    if (!user || !storedHash) {
      return next(unauthorized('invalid_credentials', 'Invalid credentials'));
    }

    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      return next(unauthorized('invalid_credentials', 'Invalid credentials'));
    }

    const token = signJwt(user);

    return ok(res, {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
   ME
========================= */
authRouter.get('/me', requireAuth, async (req, res) => {
  return ok(res, {
    user: {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
    },
  });
});