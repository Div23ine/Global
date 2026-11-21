/** Health / readiness probe. Dependency status is reported honestly. */
import { Router } from 'express';
import { env, supabaseConfigured } from '../config/env';
import { ok } from '../utils/httpError';

export const healthRouter = Router();

/**
 * Public browser configuration.
 * Only the Supabase project URL and anon key are safe to expose to browsers.
 * The service-role key and every other backend secret remain private.
 */
healthRouter.get('/public-config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!env.supabase.url || !env.supabase.anonKey) {
    res.status(503).json({
      success: false,
      code: 'SERVICE_NOT_CONFIGURED',
      message: 'Public authentication configuration is not available.',
    });
    return;
  }
  ok(res, {
    supabaseUrl: env.supabase.url,
    supabaseAnonKey: env.supabase.anonKey,
  }, 'Public configuration');
});


healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
    environment: env.nodeEnv,
    checks: {
      database: supabaseConfigured() ? 'configured' : 'not_configured',
      auth: supabaseConfigured() ? 'configured' : 'not_configured',
      twilio: env.twilio.accountSid ? 'configured' : 'not_configured',
    },
  }, 'Service healthy');
});
