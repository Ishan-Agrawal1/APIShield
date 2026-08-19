import { Router, type Request, type Response } from 'express';
import users from '../data/users.js';

const router = Router();

// GET /users - list all users
router.get('/', (_req: Request, res: Response) => {
  res.json(users);
});

// GET /users/:id - get a single user by id
router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

export default router;
