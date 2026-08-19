import { Router } from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import adminRouter from './admin.js';
import productsRouter from './products.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/admin/users', adminRouter);
router.use('/products', productsRouter);
router.use('/v1/users', usersRouter); // versioned alias

export default router;
