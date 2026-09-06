import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use(httpLogger);

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
