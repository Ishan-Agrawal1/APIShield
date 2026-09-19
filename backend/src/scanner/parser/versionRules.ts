import type { ApiParameter, SecurityRequirement, SecurityScheme, SpecWarning } from '@apishield/contracts';

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query']);
const PATH_ITEM_METADATA = new Set([
  'summary',
  'description',
  'servers',
  'parameters',
  '$ref',
  'additionalOperations',
]);

export function isHttpMethod(key: string): boolean {
  return HTTP_METHODS.has(key.toLowerCase());
}

export function isMetadataKey(key: string): boolean {
  return PATH_ITEM_METADATA.has(key) || key.startsWith('x-');
}

export function parseVersion(openapi: unknown): { raw: string; family: '3.0' | '3.1' | '3.2' | 'other' } {
  const raw = typeof openapi === 'string' ? openapi : '';
  if (raw.startsWith('3.2')) {
    return { raw, family: '3.2' };
  }
  if (raw.startsWith('3.1')) {
    return { raw, family: '3.1' };
  }
  if (raw.startsWith('3.0')) {
    return { raw, family: '3.0' };
  }
  return { raw, family: 'other' };
}

export function mergeParameters(
  pathParams: unknown,
  operationParams: unknown,
): ApiParameter[] {
  const merged = new Map<string, ApiParameter>();
  for (const param of normalizeParameters(pathParams)) {
    merged.set(`${param.location}:${param.name}`, param);
  }
  for (const param of normalizeParameters(operationParams)) {
    merged.set(`${param.location}:${param.name}`, param);
  }
  return [...merged.values()];
}

function normalizeParameters(value: unknown): ApiParameter[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const output: ApiParameter[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const location = String(record.in ?? '');
    if (!['path', 'query', 'header', 'cookie'].includes(location)) {
      continue;
    }
    output.push({
      name: String(record.name ?? ''),
      location: location as ApiParameter['location'],
      required: Boolean(record.required) || location === 'path',
      schema: (record.schema as Record<string, unknown>) ?? { type: 'string' },
      example: record.example,
      default: (record.schema as { default?: unknown } | undefined)?.default ?? record.default,
      style: typeof record.style === 'string' ? record.style : undefined,
      explode: typeof record.explode === 'boolean' ? record.explode : undefined,
    });
  }
  return output;
}

export function effectiveSecurity(
  rootSecurity: unknown,
  operationSecurity: unknown,
): SecurityRequirement[] {
  const source = operationSecurity === undefined ? rootSecurity : operationSecurity;
  if (!Array.isArray(source)) {
    return [];
  }
  return source.map((item) => {
    if (!item || typeof item !== 'object') {
      return {};
    }
    const requirement: SecurityRequirement = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      requirement[key] = Array.isArray(value) ? value.map(String) : [];
    }
    return requirement;
  });
}

export function securityRequiresAuth(requirements: SecurityRequirement[]): boolean {
  if (requirements.length === 0) {
    return false;
  }
  return requirements.every((requirement) => Object.keys(requirement).length > 0);
}

export function collectSecuritySchemes(components: unknown): Record<string, SecurityScheme> {
  if (!components || typeof components !== 'object') {
    return {};
  }
  const schemes = (components as { securitySchemes?: Record<string, Record<string, unknown>> }).securitySchemes;
  if (!schemes) {
    return {};
  }
  const output: Record<string, SecurityScheme> = {};
  for (const [name, scheme] of Object.entries(schemes)) {
    output[name] = {
      type: String(scheme.type ?? ''),
      scheme: typeof scheme.scheme === 'string' ? scheme.scheme : undefined,
      bearerFormat: typeof scheme.bearerFormat === 'string' ? scheme.bearerFormat : undefined,
      name: typeof scheme.name === 'string' ? scheme.name : undefined,
      in: typeof scheme.in === 'string' ? scheme.in : undefined,
      description: typeof scheme.description === 'string' ? scheme.description : undefined,
    };
  }
  return output;
}

export function serverCandidates(rootServers: unknown, pathServers: unknown, operationServers: unknown): string[] {
  const pick = [operationServers, pathServers, rootServers].find((value) => Array.isArray(value) && value.length > 0);
  if (!Array.isArray(pick)) {
    return [];
  }
  return pick
    .map((server) => (server && typeof server === 'object' ? String((server as { url?: string }).url ?? '') : ''))
    .filter(Boolean);
}

export function warning(code: string, message: string, location?: string): SpecWarning {
  return { code, message, location };
}
