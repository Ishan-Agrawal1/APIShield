import { Router, type Request, type Response } from 'express';
import users from '../data/users.js';

const router = Router();

// GET /admin/users - placeholder admin route (returns same user list)
router.get('/', (_req: Request, res: Response) => {
  // In a real app you would check admin privileges here.
  res.json({ admin: true, users });
});

export default router;
