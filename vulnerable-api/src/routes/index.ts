/**
 * Route Index — Mounts all API route groups
 * 
 * Documented endpoints (in OpenAPI spec):
 *   /api/auth/*
 *   /api/users/*
 *   /api/products/*
 * 
 * Undocumented/legacy endpoints (V05 — Improper Inventory Management):
 *   /api/admin/users     — admin endpoint not in OpenAPI spec
 *   /api/v1/users        — versioned alias not in OpenAPI spec
 *   /api/admin-old       — deprecated legacy endpoint not in OpenAPI spec
 */
import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import adminRouter from './admin.js';
import productsRouter from './products.js';
import { legacyAdminUsers } from '../controllers/adminController.js';

const router = Router();

// ─── Documented Routes ───────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/products', productsRouter);

// ─── Undocumented / Legacy Routes (V05 — Inventory Management) ──────
// These endpoints are NOT listed in the OpenAPI specification.
// The scanner should discover and flag them.

router.use('/admin/users', adminRouter);           // Admin panel — not in docs
router.use('/v1/users', usersRouter);              // Legacy versioned alias
router.get('/admin-old', legacyAdminUsers);        // Deprecated legacy endpoint

export default router;
