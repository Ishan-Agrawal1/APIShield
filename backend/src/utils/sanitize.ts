import { LIMITS } from '@apishield/contracts';

const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|token|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|proxy-authorization|cookie|set-cookie|secret|jwt|api[_-]?key|apikey|credit[_-]?card|ssn|session)$/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._\-+=/]+/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function sanitize(value: unknown, options?: { maxDepth?: number; maxNodes?: number }): unknown {
  const maxDepth = options?.maxDepth ?? LIMITS.sanitizerMaxDepth;
  const maxNodes = options?.maxNodes ?? LIMITS.sanitizerMaxNodes;
  const state = { nodes: 0 };
  return sanitizeNode(value, 0, maxDepth, maxNodes, state, new WeakSet());
}

function sanitizeNode(
  value: unknown,
  depth: number,
  maxDepth: number,
  maxNodes: number,
  state: { nodes: number },
  seen: WeakSet<object>,
): unknown {
  state.nodes += 1;
  if (state.nodes > maxNodes || depth > maxDepth) {
    return '[TRUNCATED]';
  }

  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (seen.has(value)) {
    return '[CYCLE]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNode(item, depth + 1, maxDepth, maxNodes, state, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitizeNode(nested, depth + 1, maxDepth, maxNodes, state, seen);
  }
  return output;
}

export function redactString(value: string): string {
  const clipped =
    value.length > LIMITS.sanitizerMaxStringLength
      ? `${value.slice(0, LIMITS.sanitizerMaxStringLength)}…`
      : value;
  return clipped
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
}

export function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    const sensitiveQuery = ['token', 'access_token', 'refresh_token', 'password', 'secret', 'api_key', 'apikey'];
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveQuery.includes(key.toLowerCase())) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return redactString(url.toString());
  } catch {
    return redactString(rawUrl);
  }
}

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactString(value);
    }
  }
  return output;
}

export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

const AI_ALLOWED_FIELDS = new Set([
  'ruleId',
  'vulnerability',
  'severity',
  'confidence',
  'endpoint',
  'method',
  'parameter',
  'description',
  'conclusion',
  'objectIdentity',
]);

export function minimizeForAi(finding: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const payload: Record<string, unknown> = {};
    for (const key of AI_ALLOWED_FIELDS) {
      if (key in finding) {
        payload[key] = sanitize(finding[key]);
      }
    }
    if (typeof finding.endpoint === 'string') {
      payload.endpoint = finding.endpoint;
    }
    return payload;
  } catch {
    return null;
  }
}

export function containsSeededSecret(value: unknown, secrets: string[]): boolean {
  const serialized = JSON.stringify(value);
  return secrets.some((secret) => secret.length > 0 && serialized.includes(secret));
}
