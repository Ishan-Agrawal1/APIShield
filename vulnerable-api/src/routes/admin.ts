/**
 * Admin Routes
 * 
 * GET /api/admin/users — List all users with admin metadata
 * 
 * VULNERABILITY (V02): No authentication middleware applied.
 * Anyone can access admin data without a valid JWT.
 * → API2:2023 — Broken Authentication
 */
import { Router } from 'express';
import { getAdminUsers } from '../controllers/adminController.js';

const router = Router();

// GET /api/admin/users — NO AUTH MIDDLEWARE (intentional vulnerability)
router.get('/', getAdminUsers);

export default router;
