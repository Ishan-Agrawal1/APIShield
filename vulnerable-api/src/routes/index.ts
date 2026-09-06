import { Router } from 'express';
import { getDebug, getHealth, getV1Notes, getV2Notes } from '../controllers/inventoryController.js';
import { getProfile } from '../controllers/profileController.js';
import { authMiddleware } from '../middleware/auth.js';
import notesRouter from './notes.js';
import usersRouter from './users.js';

const router = Router();

router.get('/health', getHealth);

// Documented application routes
router.use('/users', usersRouter);
router.use('/notes', notesRouter);

// INTENTIONAL V3 — no authentication middleware
router.get('/profile', getProfile);

// INTENTIONAL V5 — undocumented inventory endpoints
router.get('/v1/notes', authMiddleware, getV1Notes);
router.get('/v2/notes', authMiddleware, getV2Notes);
router.get('/debug', getDebug);

export default router;
