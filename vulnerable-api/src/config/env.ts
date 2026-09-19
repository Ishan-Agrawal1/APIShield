export function getPort(): number {
  return Number(process.env.PORT) || 5001;
}

export function getBindHost(): string {
  return process.env.BIND_HOST || '127.0.0.1';
}

export function getMongoUri(): string {
  return process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vulnerable-api';
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

export function getAppMode(): 'vulnerable' | 'fixed' {
  return process.env.APP_MODE === 'fixed' ? 'fixed' : 'vulnerable';
}

export function isVulnerable(): boolean {
  return getAppMode() === 'vulnerable';
}

export function getCorsOrigin(): string {
  return process.env.CORS_ORIGIN || 'http://127.0.0.1:3000';
}

export function fixtureHelpersEnabled(): boolean {
  return process.env.ENABLE_FIXTURE_HELPERS === 'true';
}

export function isDemoDatabaseName(name: string | undefined): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_DB === 'true') {
    return true;
  }
  if (!name) {
    return false;
  }
  return name === 'vulnerable-api' || name === 'vulnerable-api-fixed' || name.startsWith('vulnerable-api');
}
