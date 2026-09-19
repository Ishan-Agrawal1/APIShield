import type { NextFunction, Request, Response } from 'express';
import { isAppError } from '../utils/errors.js';
import { sanitize } from '../utils/sanitize.js';

export default function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(err)) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Request failed.',
      },
    });
    return;
  }

  console.error('[Error]', sanitize({ message: err instanceof Error ? err.message : 'unknown' }));
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    },
  });
}
