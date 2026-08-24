/**
 * JWT Authentication Middleware
 * 
 * Verifies the Bearer token from the Authorization header and attaches
 * the decoded payload to `req.user`.
 * 
 * Usage:
 *   router.get('/protected', authMiddleware, handler);
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-insecure-secret-key-12345';

/**
 * Extend Express Request to include user payload from JWT.
 */
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

/**
 * Middleware that checks for a valid JWT in the Authorization header.
 * Returns 401 if the token is missing or invalid.
 */
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
