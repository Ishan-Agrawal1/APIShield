import type { Request, Response } from 'express';
import { User, toPublicUser } from '../models/User.js';

/**
 * GET /api/profile
 *
 * INTENTIONAL V3 in vulnerable mode — Broken Authentication.
 * Fixed mode requires a valid bearer token and returns the authenticated user.
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  if (process.env.APP_MODE === 'fixed') {
    const requesterId = req.user?.userId;
    if (!requesterId) {
      res.status(401).json({ error: 'Unauthorized. A valid bearer token is required.' });
      return;
    }
    const user = await User.findById(requesterId);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    res.status(200).json(toPublicUser(user));
    return;
  }

  const user = await User.findById(1);
  res.status(200).json({
    ...(user ? toPublicUser(user) : { id: 1, email: 'user1@test.com', role: 'user' }),
    warning:
      'GET /api/profile is intentionally unauthenticated. A secure API would return 401 without a valid token.',
  });
}
