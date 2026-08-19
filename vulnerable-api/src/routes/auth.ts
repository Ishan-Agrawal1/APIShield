import { Router, type Request, type Response } from 'express';

const router = Router();

router.post('/login', (_req: Request, res: Response) => {
  // Dummy login – in a real app you'd validate credentials.
  res.json({ token: 'dummy-token' });
});

export default router;
