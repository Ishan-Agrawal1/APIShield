import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { loadEnv } from './config/env.js';
import { LIMITS } from './config/limits.js';
import logger from './middleware/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { hostCheck } from './middleware/hostCheck.js';
import { operatorAuth } from './middleware/operatorAuth.js';
import { boundedBody } from './middleware/upload.js';
import rootRouter from './routes/root.js';
import specificationsRouter from './routes/specifications.js';
import targetsRouter from './routes/targets.js';
import scansRouter from './routes/scans.js';
import findingsRouter from './routes/findings.js';

export function createApp(): Express {
  const env = loadEnv();
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.allowedOrigins, credentials: true }));
  app.use(boundedBody);
  app.use(express.json({ limit: LIMITS.openApiUploadBytes }));
  app.use(express.text({ type: ['application/yaml', 'text/yaml', 'application/x-yaml', 'text/plain'], limit: LIMITS.openApiUploadBytes }));
  app.use(logger);
  app.use(hostCheck);
  app.use(rootRouter);
  app.use('/api/specifications', operatorAuth, specificationsRouter);
  app.use('/api/targets', operatorAuth, targetsRouter);
  app.use('/api/scans', operatorAuth, scansRouter);
  app.use('/api/findings', operatorAuth, findingsRouter);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route Not Found' } });
  });
  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
