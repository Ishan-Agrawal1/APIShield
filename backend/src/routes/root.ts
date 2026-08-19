import { Router, type Request, type Response } from 'express';

const rootRouter = Router();

// Root health and status routes
rootRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'APIShield API Server is running' });
});

rootRouter.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default rootRouter;