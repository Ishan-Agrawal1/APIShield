import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/tokens.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized. A valid bearer token is required.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized. The bearer token is invalid or expired.' });
  }
}
