export function selectValue(source: unknown, selector: string): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const parts = selector.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function omitVolatile(source: unknown, volatile: string[]): unknown {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source;
  }
  const copy = { ...(source as Record<string, unknown>) };
  for (const key of volatile) {
    delete copy[key];
  }
  return copy;
}

export function bodyLooksLikeLoginPage(body: unknown): boolean {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  return /<html/i.test(text) && /login|sign in/i.test(text);
}

export function genericErrorBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const keys = Object.keys(body as Record<string, unknown>);
  return keys.length <= 2 && ('error' in (body as object) || 'message' in (body as object));
}
