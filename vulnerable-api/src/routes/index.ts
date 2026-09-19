import { Router } from 'express';
import { getDebug, getHealth, getPublicNotices, getV1Notes, getV2Notes } from '../controllers/inventoryController.js';
import { getExpiredToken } from '../controllers/labController.js';
import { getProfile } from '../controllers/profileController.js';
import { authMiddleware } from '../middleware/auth.js';
import notesRouter from './notes.js';
import usersRouter from './users.js';

const router = Router();

router.get('/health', getHealth);
router.get('/public/notices', getPublicNotices);
router.get('/lab/expired-token', getExpiredToken);

// Documented application routes
router.use('/users', usersRouter);
router.use('/notes', notesRouter);

// INTENTIONAL V3 in vulnerable mode — no authentication middleware
function maybeAuth(req: Parameters<typeof authMiddleware>[0], res: Parameters<typeof authMiddleware>[1], next: Parameters<typeof authMiddleware>[2]): void {
  if (process.env.APP_MODE === 'fixed') {
    authMiddleware(req, res, next);
    return;
  }
  next();
}

router.get('/profile', maybeAuth, getProfile);

// INTENTIONAL V5 — undocumented inventory endpoints
router.get('/v1/notes', authMiddleware, getV1Notes);
router.get('/v2/notes', authMiddleware, getV2Notes);
router.get('/debug', getDebug);

export default router;
