/**
 * Uniform API error type + response envelope helpers.
 * Error shape: { success: false, code, message } — stable codes documented
 * in API_SPECIFICATION.md. Never leak stack traces to clients.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'RATE_LIMITED'
  | 'SERVICE_NOT_CONFIGURED'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 422,
  RATE_LIMITED: 429,
  SERVICE_NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown): ApiError =>
  new ApiError('VALIDATION_ERROR', m, d);
export const unauthenticated = (m = 'Authentication required'): ApiError =>
  new ApiError('UNAUTHENTICATED', m);
export const forbidden = (m = 'You do not have permission to perform this action'): ApiError =>
  new ApiError('FORBIDDEN', m);
export const notFound = (m = 'Resource not found'): ApiError => new ApiError('NOT_FOUND', m);
export const conflict = (m: string, d?: unknown): ApiError => new ApiError('CONFLICT', m, d);
export const invalidState = (m: string, d?: unknown): ApiError =>
  new ApiError('INVALID_STATE', m, d);
export const notConfigured = (service: string): ApiError =>
  new ApiError('SERVICE_NOT_CONFIGURED', `${service} is not configured in this environment`);

export interface Meta {
  page?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
  [k: string]: unknown;
}

export function ok(res: { status(code: number): unknown; json(body: unknown): unknown }, data: unknown, message = '', meta?: Meta): void {
  res.status(200);
  res.json({ success: true, message, data, meta: meta ?? {} });
}

export function created(res: { status(code: number): unknown; json(body: unknown): unknown }, data: unknown, message = '', meta?: Meta): void {
  res.status(201);
  res.json({ success: true, message, data, meta: meta ?? {} });
}
