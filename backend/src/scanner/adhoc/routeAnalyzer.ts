import type { ApiEndpoint, ApiParameter, RouteScanInput } from '@apishield/contracts';
import { LIMITS } from '@apishield/contracts';
import { loadTargetProfiles } from '../../config/targetProfiles.js';
import { AppError } from '../../utils/errors.js';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']);
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_PARAMS = 20;

export interface ObjectIdParameter {
  name: string;
  value: string;
}

/**
 * Normalized view of a single user-supplied route. The endpoint is the same
 * `ApiEndpoint` shape the OpenAPI parser produces, so the generator, executor,
 * persistence, and UI treat an ad-hoc route exactly like a discovered one.
 */
export interface AnalyzedRoute {
  origin: string;
  method: string;
  endpoint: Omit<ApiEndpoint, 'id' | 'specificationId'>;
  pathValues: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: unknown;
  /** Full Authorization header value. Held in memory only; never persisted. */
  authorizationHeader: string | null;
  objectIdParameter: ObjectIdParameter | null;
  safeMethod: boolean;
}

export function analyzeRoute(input: RouteScanInput): AnalyzedRoute {
  const method = String(input.method ?? 'GET').trim().toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new AppError(400, 'INVALID_METHOD', `HTTP method must be one of ${[...ALLOWED_METHODS].join(', ')}.`);
  }

  const rawUrl = String(input.url ?? '').trim();
  if (!rawUrl) {
    throw new AppError(400, 'MISSING_ROUTE_URL', 'A target URL is required, e.g. http://127.0.0.1:5001/api/notes/{id}.');
  }
  if (rawUrl.length > LIMITS.maxUrlLength) {
    throw new AppError(400, 'ROUTE_URL_TOO_LONG', `Target URL exceeds ${LIMITS.maxUrlLength} characters.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(400, 'INVALID_ROUTE_URL', 'Target URL could not be parsed. Include the scheme, e.g. http://127.0.0.1:5001/api/notes/{id}.');
  }
  if (parsed.username || parsed.password) {
    throw new AppError(400, 'EMBEDDED_CREDENTIALS', 'Do not embed credentials in the URL. Use the Authorization field instead.');
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  assertOriginScannable(origin);

  const pathname = decodePath(parsed.pathname);
  const pathParams = stringRecord(input.pathParams, 'pathParams');
  const { pathTemplate, pathValues } = buildPathTemplate(pathname, pathParams);
  const query = buildQuery(parsed.searchParams, input.queryParams);
  const headers = buildHeaders(input.headers);
  const authorizationHeader = normalizeAuthorization(input.authorization);
  const objectIdParameter = pickObjectIdParameter(pathValues);
  const safeMethod = SAFE_METHODS.has(method);

  const body = method === 'GET' || method === 'HEAD' ? undefined : input.body;
  if (body !== undefined && Buffer.byteLength(JSON.stringify(body) ?? '') > LIMITS.maxRequestBodyBytes) {
    throw new AppError(413, 'REQUEST_BODY_TOO_LARGE', `Request body exceeds ${LIMITS.maxRequestBodyBytes} bytes.`);
  }

  const parameters: ApiParameter[] = [
    ...Object.entries(pathValues).map(([name, value]) => ({
      name,
      location: 'path' as const,
      required: true,
      schema: { type: /^-?\d+$/.test(value) ? 'integer' : 'string' },
      example: value,
    })),
    ...Object.entries(query).map(([name, value]) => ({
      name,
      location: 'query' as const,
      required: false,
      schema: { type: Array.isArray(value) ? 'array' : /^-?\d+$/.test(value) ? 'integer' : 'string' },
      example: value,
    })),
  ];

  const requiresAuth = authorizationHeader !== null;
  const endpoint: Omit<ApiEndpoint, 'id' | 'specificationId'> = {
    operationId: undefined,
    pathTemplate,
    method: method.toLowerCase(),
    parameters,
    requestBody:
      body !== undefined
        ? { required: false, contentType: 'application/json', example: body }
        : undefined,
    responses: {},
    effectiveSecurity: requiresAuth ? [{ bearerAuth: [] }] : [],
    securitySchemes: requiresAuth ? { bearerAuth: { type: 'http', scheme: 'bearer' } } : {},
    serverCandidates: [origin],
    supportStatus: 'supported',
    warnings: [],
  };

  return {
    origin,
    method,
    endpoint,
    pathValues,
    query,
    headers,
    body,
    authorizationHeader,
    objectIdParameter,
    safeMethod,
  };
}

/**
 * Ad-hoc routes are restricted to loopback hosts or an origin that a
 * server-side target profile already approves. This keeps the executor's
 * SSRF posture: a pasted URL cannot reach cloud metadata, private networks,
 * or arbitrary internet hosts. The executor's DNS guard still runs on every
 * request as a second layer.
 */
export function assertOriginScannable(origin: string): void {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new AppError(400, 'INVALID_ROUTE_URL', 'Target origin could not be parsed.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(403, 'PROTOCOL_DENIED', 'Only HTTP and HTTPS targets are allowed.');
  }
  if (isLoopbackHost(url.hostname)) {
    return;
  }
  const approved = loadTargetProfiles().some((profile) => {
    try {
      const allowed = new URL(profile.approvedOrigin);
      return allowed.protocol === url.protocol && allowed.hostname === url.hostname && allowed.port === url.port;
    } catch {
      return false;
    }
  });
  if (!approved) {
    throw new AppError(
      403,
      'ORIGIN_NOT_AUTHORIZED',
      'Route testing is restricted to loopback targets (127.0.0.1, localhost, ::1) or an approved target profile. Scan only APIs you are authorized to test.',
    );
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/**
 * Accepts either a templated path (`/api/notes/{id}` plus `id=1`) or a concrete
 * path (`/api/notes/1`). Concrete segments that match a supplied path parameter
 * value become placeholders; otherwise a trailing numeric segment is treated as
 * an implicit `{id}` so object-level checks still have something to vary.
 */
function buildPathTemplate(
  pathname: string,
  pathParams: Record<string, string>,
): { pathTemplate: string; pathValues: Record<string, string> } {
  const placeholders = [...pathname.matchAll(/\{([^}/]+)\}/g)].map((match) => match[1] ?? '').filter(Boolean);
  if (placeholders.length > 0) {
    const pathValues: Record<string, string> = {};
    const missing: string[] = [];
    for (const name of placeholders) {
      const value = pathParams[name];
      if (value === undefined || value === '') {
        missing.push(name);
      } else {
        pathValues[name] = value;
      }
    }
    if (missing.length > 0) {
      throw new AppError(400, 'MISSING_PATH_PARAMETER', `Provide a value for path parameter(s): ${missing.join(', ')}.`);
    }
    return { pathTemplate: pathname, pathValues };
  }

  const segments = pathname.split('/');
  const pathValues: Record<string, string> = {};
  for (const [name, value] of Object.entries(pathParams)) {
    const index = segments.findIndex((segment, position) => position > 0 && segment === value);
    if (index > 0) {
      segments[index] = `{${name}}`;
      pathValues[name] = value;
    }
  }
  if (Object.keys(pathValues).length === 0) {
    const last = segments.length - 1;
    const tail = segments[last];
    if (last > 0 && tail && /^\d+$/.test(tail)) {
      segments[last] = '{id}';
      pathValues.id = tail;
    }
  }
  return { pathTemplate: segments.join('/') || '/', pathValues };
}

function buildQuery(
  search: URLSearchParams,
  explicit: RouteScanInput['queryParams'],
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const all = search.getAll(key);
    query[key] = all.length > 1 ? all : (all[0] ?? '');
  }
  if (explicit && typeof explicit === 'object') {
    for (const [key, value] of Object.entries(explicit)) {
      if (!key) {
        continue;
      }
      query[key] = Array.isArray(value) ? value.map(String) : String(value ?? '');
    }
  }
  if (Object.keys(query).length > MAX_PARAMS) {
    throw new AppError(400, 'TOO_MANY_PARAMETERS', `At most ${MAX_PARAMS} query parameters are supported.`);
  }
  return query;
}

function buildHeaders(input: RouteScanInput['headers']): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(stringRecord(input, 'headers'))) {
    const name = key.trim().toLowerCase();
    // Credentials travel through the in-memory credential store, never as a
    // static header, so auth variants can add or remove them per test case.
    if (!name || name === 'authorization' || name === 'cookie' || name === 'host' || name === 'content-length') {
      continue;
    }
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) {
      throw new AppError(400, 'INVALID_HEADER_NAME', `Header name "${key}" is not a valid HTTP token.`);
    }
    if (value.length > LIMITS.maxHeaderValueLength || /[\r\n]/.test(value)) {
      throw new AppError(400, 'INVALID_HEADER_VALUE', `Header "${key}" is too long or contains line breaks.`);
    }
    headers[name] = value;
  }
  return headers;
}

function normalizeAuthorization(value: RouteScanInput['authorization']): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > LIMITS.maxHeaderValueLength || /[\r\n]/.test(trimmed)) {
    throw new AppError(400, 'INVALID_AUTHORIZATION', 'Authorization value is too long or contains line breaks.');
  }
  // A bare token is treated as a bearer token; an explicit scheme is kept.
  return /^[A-Za-z][A-Za-z0-9_-]*\s+\S/.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function pickObjectIdParameter(pathValues: Record<string, string>): ObjectIdParameter | null {
  const numeric = Object.entries(pathValues).filter(([, value]) => /^\d+$/.test(value));
  const preferred = numeric.find(([name]) => /id$/i.test(name)) ?? numeric[numeric.length - 1];
  return preferred ? { name: preferred[0], value: preferred[1] } : null;
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'INVALID_ROUTE_INPUT', `${field} must be an object of string values.`);
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PARAMS) {
    throw new AppError(400, 'TOO_MANY_PARAMETERS', `At most ${MAX_PARAMS} entries are supported in ${field}.`);
  }
  const output: Record<string, string> = {};
  for (const [key, item] of entries) {
    if (item === undefined || item === null) {
      continue;
    }
    if (typeof item === 'object') {
      throw new AppError(400, 'INVALID_ROUTE_INPUT', `${field}.${key} must be a string.`);
    }
    output[key.trim()] = String(item).trim();
  }
  return output;
}
