/** Rate limiting: per-IP global bucket + per-user mutation buckets. */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const standard = (opts: { windowMs: number; max: number; keyGenerator?: (req: { ip?: string; auth?: { userId: string } }) => string }) =>
  rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator
      ? (req) => opts.keyGenerator?.(req) ?? ''
      : undefined,
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests — slow down.' },
  });

export const globalLimiter = standard({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.max });

const perUser = (max: number) =>
  standard({
    windowMs: 60_000,
    max,
    keyGenerator: (req) => `${req.auth?.userId ?? 'anon'}:${req.ip ?? 'unknown'}`,
  });

export const depositLimiter = perUser(env.rateLimit.depositPerMin);
export const supportLimiter = perUser(env.rateLimit.supportPerMin);
