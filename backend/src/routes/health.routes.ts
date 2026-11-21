/** Health / readiness probe. Dependency status is reported honestly. */
import { Router } from 'express';
import { env, supabaseConfigured } from '../config/env';
import { ok } from '../utils/httpError';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
    environment: env.nodeEnv,
    checks: {
      database: supabaseConfigured() ? 'configured' : 'not_configured',
      clerk: env.clerk.secretKey ? 'configured' : 'not_configured',
      twilio: env.twilio.accountSid ? 'configured' : 'not_configured',
    },
  }, 'Service healthy');
});
