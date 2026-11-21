/**
 * Express application assembly.
 * Order: security headers -> CORS -> request id -> raw-body payment webhook ->
 * JSON parsing (with size caps) -> rate limit -> /api/v1 routes -> 404 ->
 * error handler. Payment webhooks mount before JSON parsing so their
 * signature checks can use the exact raw request body.
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

export function createApp(rateLimitBindings?: RateLimitBindings): Express {
  const app = express();
  app.locals.rateLimitBindings = rateLimitBindings ?? {};
  // When called by the Worker, missing bindings must fail closed rather than
  // silently falling back to per-isolate in-memory counters.
  app.locals.requireCloudflareRateLimits = rateLimitBindings !== undefined;

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.corsOrigin.includes(origin)) cb(null, true);
        else cb(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-meridian-signature',
],
      maxAge: 600,
    }),
  );

  // Request id + child logger binding.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;
    next();
  });

  // Webhooks: raw body preserved for signature verification.
  app.use(
    '/api/v1/webhooks',
    express.raw({ type: 'application/json', limit: '256kb' }),
    (req: Request, res: Response, next: NextFunction) => {
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
