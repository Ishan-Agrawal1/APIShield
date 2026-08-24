/**
 * Admin Controller
 * 
 * VULNERABILITY (V02): This controller's routes are mounted WITHOUT
 * authentication middleware. Any unauthenticated request can access
 * admin-level data.
 * → API2:2023 — Broken Authentication
 */
import type { Request, Response } from 'express';
import { getUsers } from '../config/db.js';
import type { SafeUser } from '../models/User.js';

/**
 * GET /api/admin/users
 * 
 * Returns all users with admin metadata.
 * 
 * VULNERABLE: No auth middleware protects this route.
 * Any client — even without a JWT — gets full user data.
 * 
 * Secure version would:
 *   1. Require authentication (authMiddleware)
 *   2. Require admin role (req.user.role === 'admin')
 */
export const getAdminUsers = (_req: Request, res: Response): void => {
  const users = getUsers();
  const safeUsers: SafeUser[] = users.map(({ password: _, ...rest }) => rest);

  // ⚠️  BROKEN AUTH VULNERABILITY: No authentication or authorization check!
  // Returns sensitive admin view of all users to anyone.
  res.json({
    admin: true,
    totalUsers: users.length,
    users: safeUsers,
  });
};

/**
 * GET /api/admin-old (legacy endpoint)
 * 
 * Same as getAdminUsers but represents an undocumented legacy endpoint.
 * Used for Improper Inventory Management testing (V05).
 */
export const legacyAdminUsers = (_req: Request, res: Response): void => {
  const users = getUsers();
  const safeUsers: SafeUser[] = users.map(({ password: _, ...rest }) => rest);

  res.json({
    legacy: true,
    warning: 'This is a deprecated endpoint',
    users: safeUsers,
  });
};
