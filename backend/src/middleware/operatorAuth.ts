import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function operatorAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = loadEnv().operatorToken;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ') || header.slice(7).trim() !== expected) {
    next(new AppError(401, 'OPERATOR_UNAUTHORIZED', 'Operator authentication is required.'));
    return;
  }
  next();
}
