import type { Request, Response } from 'express';
import { User, toPublicUser } from '../models/User.js';

/**
 * GET /api/profile
 *
 * INTENTIONAL V3 — Broken Authentication:
 * This handler never inspects the Authorization header. Missing, invalid,
 * and expired tokens all receive the same deterministic 200 response.
 */
export async function getProfile(_req: Request, res: Response): Promise<void> {
  const user = await User.findById(1);

  res.status(200).json({
    ...(user
      ? toPublicUser(user)
      : { id: 1, email: 'user1@test.com', role: 'user' }),
    warning:
      'GET /api/profile is intentionally unauthenticated. A secure API would return 401 without a valid token.',
  });
}
