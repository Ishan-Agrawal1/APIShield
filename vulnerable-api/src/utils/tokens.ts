import jwt from 'jsonwebtoken';
import { getJwtExpiresIn, getJwtSecret } from '../config/env.js';

export interface TokenPayload {
  userId: number;
  email: string;
  role: 'user' | 'admin';
}

export function signAuthToken(payload: TokenPayload, expiresIn = getJwtExpiresIn()): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAuthToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}

export function decodeAuthToken(token: string): TokenPayload | null {
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}
