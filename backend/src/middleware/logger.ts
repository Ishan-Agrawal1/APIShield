import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { redactUrl, sanitize } from '../utils/sanitize.js';

export default function logger(req: Request, res: Response, next: NextFunction): void {
  const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
  req.headers['x-request-id'] = requestId;
  const started = Date.now();

  res.on('finish', () => {
    const record = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: redactUrl(req.originalUrl),
      statusCode: res.statusCode,
      durationMs: Date.now() - started,
    };
    console.log(JSON.stringify(sanitize(record)));
  });
  next();
}
