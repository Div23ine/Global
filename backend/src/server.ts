/**
 * Server bootstrap: env validation, HTTP listener, graceful shutdown.
 * Run: npm run dev (tsx watch) | npm run build && npm start
 */
import { createApp } from './app';
import { env, assertProductionReadiness } from './config/env';
import { logger } from './utils/logger';

assertProductionReadiness();

const app = createApp();
const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, env: env.nodeEnv },
    'Meridian API listening',
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('connections drained — exit');
    process.exit(0);
  });
  // Hard exit if drain hangs (VM systemd timeout is longer).
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'unhandled rejection');
});
