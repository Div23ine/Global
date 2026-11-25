/**
 * Cloudflare-native rate limiting. Local buckets are for Node tests/dev only.
 */
import type { Request, RequestHandler } from 'express';

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface RateLimitBindings {
  GLOBAL_RATE_LIMITER?: RateLimitBinding;
  DEPOSIT_RATE_LIMITER?: RateLimitBinding;
  SUPPORT_RATE_LIMITER?: RateLimitBinding;
  AUTH_RATE_LIMITER?: RateLimitBinding;
}
interface LocalBucket { count: number; resetAt: number; }
const localBuckets = new Map<string, LocalBucket>();

function clientIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP at the edge and clients cannot override
  // it behind the Worker. Prefer it over req.ip: with trust proxy enabled the
  // Express view of the address derives from X-Forwarded-For, whose entries a
  // client can supply, which would let requesters rotate limiter keys.
  const cf = req.get('cf-connecting-ip');
  if (cf && /^[\d.:a-fA-F]+$/.test(cf.trim())) return cf.trim();
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
        success: false, code: 'RATE_LIMITED', message: 'Too many requests — slow down.',
      });
    };
    if (!binding && req.app.locals.requireCloudflareRateLimits) {
      res.status(503).json({
        success: false, code: 'RATE_LIMITER_UNAVAILABLE',
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
    const now = Date.now();
    const bucketKey = bindingName + ':' + key;
    let bucket = localBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      localBuckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) { reject(); return; }
    if (localBuckets.size > 10_000) {
      for (const [storedKey, storedBucket] of localBuckets) {
        if (storedBucket.resetAt <= now) localBuckets.delete(storedKey);
      }
    }
    next();
  };
}
export const globalLimiter = middleware('GLOBAL_RATE_LIMITER', 300, 60_000,
  (req) => 'ip:' + clientIp(req));
export const depositLimiter = middleware('DEPOSIT_RATE_LIMITER', 10, 60_000,
  (req) => 'user:' + (req.auth?.userId ?? clientIp(req)));
export const supportLimiter = middleware('SUPPORT_RATE_LIMITER', 5, 60_000,
  (req) => 'user:' + (req.auth?.userId ?? clientIp(req)));
export const authLimiter = middleware('AUTH_RATE_LIMITER', 10, 60_000, (req) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : 'unknown';
  return 'ip:' + clientIp(req) + ':email:' + email;
});
