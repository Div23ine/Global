/** Cloudflare Workers entry — Express API. */
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app';
import { applyWorkerEnv, assertProductionReadiness } from './config/env';
import type { RateLimitBindings } from './middleware/rateLimit';
import type { CacheKVBinding } from './services/cache.service';

type Env = Record<string, unknown> & RateLimitBindings & { CACHE_KV?: CacheKVBinding };
let handler: ReturnType<typeof httpServerHandler> | null = null;
let envApplied = false;

function ensureHandler(env: Env) {
  if (!envApplied) {
    applyWorkerEnv(env);
    try {
      if (env.NODE_ENV === 'production') assertProductionReadiness();
    } catch (error) {
      console.error('Production readiness warning:', error);
    }
    envApplied = true;
  }
  if (!handler) {
    const app = createApp({
      GLOBAL_RATE_LIMITER: env.GLOBAL_RATE_LIMITER,
      DEPOSIT_RATE_LIMITER: env.DEPOSIT_RATE_LIMITER,
      SUPPORT_RATE_LIMITER: env.SUPPORT_RATE_LIMITER,
      AUTH_RATE_LIMITER: env.AUTH_RATE_LIMITER,
    }, env.CACHE_KV);
    const server = createServer(app);
    server.listen(8080);
    handler = httpServerHandler({ port: 8080 });
  }
  return handler;
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const runtime = ensureHandler(env) as unknown as {
      fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
    };
    return runtime.fetch(request, env, ctx);
  },
};
