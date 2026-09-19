import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/index.js';
import { getCorsOrigin } from './config/env.js';

const app = express();

app.disable('x-powered-by');
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.APP_MODE !== 'fixed') {
    res.setHeader('Server', 'Express/5.2.1');
    res.setHeader('X-Powered-By', 'Express');
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Origin');
      res.status(204).end();
      return;
    }
    next();
    return;
  }
  cors({ origin: getCorsOrigin() })(req, res, next);
});
app.use(express.json({ limit: '100kb' }));
app.use(httpLogger);

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
