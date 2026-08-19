import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import router from './routes/index.js';

const app: Express = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount API routes under /api
app.use('/api', router);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.stack || err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
