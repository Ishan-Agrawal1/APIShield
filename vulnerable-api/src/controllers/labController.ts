import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fixtureHelpersEnabled, getJwtSecret } from '../config/env.js';

export function getExpiredToken(_req: Request, res: Response): void {
  if (!fixtureHelpersEnabled()) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const token = jwt.sign(
    {
      userId: 1,
      email: 'user1@test.com',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) - 30,
    },
    getJwtSecret(),
  );

  res.json({ token, purpose: 'local-demo expired credential fixture' });
}
