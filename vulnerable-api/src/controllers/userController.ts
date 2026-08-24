/**
 * User Controller
 * 
 * VULNERABILITY (V01): getUserById does NOT check ownership.
 * Any authenticated user can access any other user's data by ID.
 * → API1:2023 — Broken Object Level Authorization (BOLA)
 */
import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { getUsers, getUserById as findUserById } from '../config/db.js';
import type { SafeUser } from '../models/User.js';

/**
 * GET /api/users
 * Returns all users (without passwords). Requires authentication.
 */
export const getAllUsers = (_req: AuthRequest, res: Response): void => {
  const users = getUsers();
  const safeUsers: SafeUser[] = users.map(({ password: _, ...rest }) => rest);
  res.json(safeUsers);
};

/**
 * GET /api/users/:id
 * 
 * Returns a single user by ID. Requires authentication.
 * 
 * VULNERABLE: Does NOT verify that req.user.userId === req.params.id
 * User A (ID 101) can request User B (ID 102) data freely.
 * 
 * Secure version would include:
 *   if (req.user?.userId !== id && req.user?.role !== 'admin') {
 *     return res.status(403).json({ error: 'Forbidden' });
 *   }
 */
export const getUserById = (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }

  const user = findUserById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // ⚠️  BOLA VULNERABILITY: No ownership check!
  // Any authenticated user can access any user's data.
  // The commented code below is what a SECURE implementation would look like:
  //
  // if (req.user?.userId !== id && req.user?.role !== 'admin') {
  //   res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
  //   return;
  // }

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
};
