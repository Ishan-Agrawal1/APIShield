const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'jwt',
]);

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        return [key, '[REDACTED]'];
      }
      return [key, redactValue(nested)];
    });
    return Object.fromEntries(entries);
  }

  return value;
}

export function containsSensitivePlaintext(value: unknown, secrets: string[]): boolean {
  const serialized = JSON.stringify(value);
  return secrets.some((secret) => secret.length > 0 && serialized.includes(secret));
}
