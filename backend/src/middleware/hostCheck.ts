import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function hostCheck(req: Request, _res: Response, next: NextFunction): void {
  const env = loadEnv();
  const hostHeader = req.headers.host ?? '';
  const hostname = hostHeader.split(':')[0] ?? '';
  if (!env.allowedHosts.includes(hostname)) {
    next(new AppError(400, 'INVALID_HOST', 'Host header is not allowed.'));
    return;
  }

  const origin = req.headers.origin;
  if (origin && !env.allowedOrigins.includes(origin)) {
    next(new AppError(403, 'INVALID_ORIGIN', 'Origin is not allowed.'));
    return;
  }
  next();
}
