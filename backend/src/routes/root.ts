import { Router, type Request, type Response, type NextFunction } from 'express';
import { pingMongo } from '../config/db.js';

const rootRouter = Router();

rootRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'APIShield API Server is running',
    notice: 'Scan only user-authorized targets. The bundled local demo is the default authorized scope.',
  });
});

rootRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

rootRouter.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

rootRouter.get('/ready', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mongo = await pingMongo();
    if (!mongo) {
      res.status(503).json({ error: { code: 'NOT_READY', message: 'MongoDB is not reachable.' } });
      return;
    }
    res.status(200).json({ status: 'READY', mongo: true });
  } catch (error) {
    next(error);
  }
});

export default rootRouter;
