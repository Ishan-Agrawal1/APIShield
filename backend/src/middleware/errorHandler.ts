import { type Request, type Response, type NextFunction } from 'express';

export default function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.stack || err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
}
