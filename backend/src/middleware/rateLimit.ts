/**
 * Cloudflare-native rate limiting.
 *
 * The binding is invoked only while handling a request. This avoids
 * express-rate-limit's module-initialization work, which is incompatible
 * with the Workers global scope.
 */
import type { Request, RequestHandler } from 'express';

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitBindings {
  GLOBAL_RATE_LIMITER?: RateLimitBinding;
  DEPOSIT_RATE_LIMITER?: RateLimitBinding;
  SUPPORT_RATE_LIMITER?: RateLimitBinding;
}

interface LocalBucket {
  count: number;
  resetAt: number;
}

// Used only by local Node development/tests when no Cloudflare bindings exist.
const localBuckets = new Map<string, LocalBucket>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function middleware(
  bindingName: keyof RateLimitBindings,
  max: number,
  windowMs: number,
  keyFor: (req: Request) => string,
): RequestHandler {
  return (req, res, next) => {
    const bindings = req.app.locals.rateLimitBindings as RateLimitBindings | undefined;
    const binding = bindings?.[bindingName];
    const key = keyFor(req);

    const reject = () => {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests — slow down.',
      });
    };

    if (!binding && req.app.locals.requireCloudflareRateLimits) {
      res.status(503).json({
        success: false,
        code: 'RATE_LIMITER_UNAVAILABLE',
        message: 'Request protection is temporarily unavailable.',
      });
      return;
    }

    if (binding) {
      void binding.limit({ key }).then(({ success }) => {
        if (!success) reject();
        else next();
      }).catch(next);
      return;
    }

    // Local-only fallback. Production Workers must use configured bindings.
    const now = Date.now();
    const bucketKey = `${bindingName}:${key}`;
    let bucket = localBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      localBuckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      reject();
      return;
    }

    if (localBuckets.size > 10_000) {
      for (const [storedKey, storedBucket] of localBuckets) {
        if (storedBucket.resetAt <= now) localBuckets.delete(storedKey);
      }
    }
    next();
  };
}

export const globalLimiter = middleware(
  'GLOBAL_RATE_LIMITER',
  300,
  60_000,
  (req) => `ip:${clientIp(req)}`,
);

export const depositLimiter = middleware(
  'DEPOSIT_RATE_LIMITER',
  10,
  60_000,
  (req) => `user:${req.auth?.userId ?? clientIp(req)}`,
);

export const supportLimiter = middleware(
  'SUPPORT_RATE_LIMITER',
  5,
  60_000,
  (req) => `user:${req.auth?.userId ?? clientIp(req)}`,
);
