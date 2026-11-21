/** Zod body validation middleware. Parses at the boundary; never trusts input. */
import type { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { badRequest } from '../utils/httpError';

export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        badRequest(
          'Request body failed validation',
          result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        badRequest(
          'Query parameters failed validation',
          result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
      return;
    }
    next();
  };
}
