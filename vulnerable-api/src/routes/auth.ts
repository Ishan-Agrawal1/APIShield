/**
 * Auth Routes
 * 
 * POST /api/auth/login — Login and receive JWT token
 * 
 * VULNERABILITY (V03): No rate limiting on login endpoint.
 * → API4:2023 — Unrestricted Resource Consumption
 */
import { Router } from 'express';
import { login } from '../controllers/authController.js';

const router = Router();

// POST /api/auth/login — No rate limiting applied (intentional vulnerability)
router.post('/login', login);

export default router;
