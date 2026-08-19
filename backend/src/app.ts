import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import logger from './middleware/logger.js';
import errorHandler from './middleware/errorHandler.js';
import rootRouter from './routes/root.js';

// Express instance
const app: Express = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Routes
app.use(rootRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// Global error handling middleware
app.use(errorHandler);

export default app;
