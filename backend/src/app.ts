/**
 * Express application assembly: security headers, credentialed CORS,
 * request id, raw webhook, JSON parser, rate limits, API and error handler.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { env } from './config/env';
import { api, paymentsWebhookRouter } from './routes';
import { globalLimiter, type RateLimitBindings } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { logger } from './utils/logger';
import type { CacheKVBinding } from './services/cache.service';

export function createApp(rateLimitBindings?: RateLimitBindings, cacheKv?: CacheKVBinding): Express {
  const app = express();
  app.locals.rateLimitBindings = rateLimitBindings ?? {};
  app.locals.cacheKv = cacheKv;
  app.locals.requireCloudflareRateLimits = rateLimitBindings !== undefined;
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigin.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'Idempotency-Key',
      'x-meridian-signature', 'x-meridian-csrf', 'x-meridian-customer-context',
    ],
    maxAge: 600,
  }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;
    next();
  });

  app.use(
    '/api/v1/webhooks',
    express.raw({ type: 'application/json', limit: '256kb' }),
    (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { rawBody?: string }).rawBody =
        Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      next();
    },
    paymentsWebhookRouter,
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(globalLimiter);
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
export { logger };
