/** Uniform error handler — the last middleware in the chain. */
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/httpError';
import { logger } from '../utils/logger';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Endpoint not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  // Unexpected error: log with stack, return a generic 500 (no internals).
  logger.error({ err: err instanceof Error ? err.stack : String(err) }, 'unhandled error');
  res.status(500).json({ success: false, code: 'INTERNAL', message: 'Internal server error' });
}
