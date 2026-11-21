/**
 * Cloudflare Workers entry — runs the Express app under nodejs_compat.
 *
 * Deploy:  cd backend && npx wrangler deploy
 * Local:   npx wrangler dev
 *
 * Secrets (wrangler secret put <NAME>):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
 *   RESEND_API_KEY, RESEND_FROM_EMAIL, PAYMENT_WEBHOOK_SECRET
 *
 * Vars in wrangler.toml [vars]:
 *   NODE_ENV, CORS_ORIGIN, RESEND_FROM_NAME, PAYMENT_PROVIDER
 */
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app';
import { applyWorkerEnv, assertProductionReadiness } from './config/env';
import type { RateLimitBindings } from './middleware/rateLimit';

type Env = Record<string, unknown> & RateLimitBindings;

let handler: ReturnType<typeof httpServerHandler> | null = null;
let envApplied = false;

function ensureHandler(env: Env) {
  if (!envApplied) {
    applyWorkerEnv(env);
    // Soft check — don't throw on every cold start if optional services missing
    try {
      if (env.NODE_ENV === 'production') assertProductionReadiness();
    } catch (e) {
      console.error('Production readiness warning:', e);
    }
    envApplied = true;
  }
  if (!handler) {
    const app = createApp({
      GLOBAL_RATE_LIMITER: env.GLOBAL_RATE_LIMITER,
      DEPOSIT_RATE_LIMITER: env.DEPOSIT_RATE_LIMITER,
      SUPPORT_RATE_LIMITER: env.SUPPORT_RATE_LIMITER,
    });
    const server = createServer(app);
    // Port is virtual inside the Worker isolate
    server.listen(8080);
    handler = httpServerHandler({ port: 8080 });
  }
  return handler;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const h = ensureHandler(env);
    return h.fetch(request, env, ctx);
  },
};
