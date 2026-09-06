import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { getLogFile } from '../config/env.js';
import { decodeAuthToken } from '../utils/tokens.js';
import { redactValue } from '../utils/redact.js';

export interface HttpEvent {
  timestamp: string;
  method: string;
  uri: string;
  path: string;
  query: unknown;
  params: unknown;
  statusCode: number;
  authenticated: boolean;
  userId: number | null;
  authorization: 'none' | 'bearer' | 'invalid';
  objectId: number | null;
  requestBody: unknown;
  responseBody: unknown;
}

const events: HttpEvent[] = [];

function resolveAuthContext(req: Request): Pick<HttpEvent, 'authenticated' | 'userId' | 'authorization'> {
  if (req.user) {
    return {
      authenticated: true,
      userId: req.user.userId,
      authorization: 'bearer',
    };
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { authenticated: false, userId: null, authorization: 'none' };
  }

  const token = header.slice('Bearer '.length).trim();
  const decoded = decodeAuthToken(token);
  if (!decoded) {
    return { authenticated: false, userId: null, authorization: 'invalid' };
  }

  return {
    authenticated: true,
    userId: decoded.userId,
    authorization: 'bearer',
  };
}

function writeEvent(event: HttpEvent): void {
  events.push(event);

  const line = JSON.stringify(event);
  if (process.env.NODE_ENV !== 'test') {
    process.stdout.write(`${line}\n`);
  }

  const logFile = getLogFile();
  if (!logFile) {
    return;
  }

  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${line}\n`, 'utf8');
}

export function getLogEvents(): HttpEvent[] {
  return events;
}

export function clearLogEvents(): void {
  events.length = 0;
}

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  let responseBody: unknown = undefined;

  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];

  res.on('finish', () => {
    const auth = resolveAuthContext(req);
    const rawObjectId = req.params.id;
    const objectId = rawObjectId !== undefined && rawObjectId !== '' && !Number.isNaN(Number(rawObjectId))
      ? Number(rawObjectId)
      : null;

    writeEvent({
      timestamp: new Date().toISOString(),
      method: req.method,
      uri: req.originalUrl,
      path: req.originalUrl.split('?')[0] || req.path,
      query: req.query,
      params: req.params,
      statusCode: res.statusCode,
      authenticated: auth.authenticated,
      userId: auth.userId,
      authorization: auth.authorization,
      objectId,
      requestBody: redactValue(req.body ?? {}),
      responseBody: redactValue(responseBody ?? {}),
    });
  });

  next();
}
