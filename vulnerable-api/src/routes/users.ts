/**
 * User Routes
 * 
 * GET /api/users      — List all users (requires auth)
 * GET /api/users/:id  — Get single user by ID (requires auth)
 * 
 * VULNERABILITY (V01): GET /:id does NOT check ownership (BOLA).
 * → API1:2023 — Broken Object Level Authorization
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAllUsers, getUserById } from '../controllers/userController.js';

const router = Router();

// GET /api/users — List all users (authenticated)
router.get('/', authMiddleware, getAllUsers);

// GET /api/users/:id — Get user by ID (authenticated, but NO ownership check)
router.get('/:id', authMiddleware, getUserById);

export default router;
