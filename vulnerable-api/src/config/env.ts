export function getPort(): number {
  return Number(process.env.PORT) || 5001;
}

export function getMongoUri(): string {
  return process.env.MONGO_URI || 'mongodb://localhost:27017/vulnerable-api';
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'lab-only-not-a-real-secret';
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '24h';
}

export function getLogFile(): string | null {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const configured = process.env.LOG_FILE;
  if (configured === '') {
    return null;
  }

  return configured || 'logs/http-events.jsonl';
}
