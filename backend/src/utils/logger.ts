/** Structured JSON logging (pino). Never log secrets, tokens or codes. */
import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.logLevel,
  base: { service: 'meridian-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'otp',
      '*.password',
      '*.token',
      '*.otp',
      'secretKey',
      'serviceRoleKey',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
