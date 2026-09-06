import { Router } from 'express';
import { getUserById, listUsers } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listUsers);
router.get('/:id', authMiddleware, getUserById);

export default router;
