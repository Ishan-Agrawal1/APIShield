import { parse as parseYaml } from 'yaml';
import { LIMITS, type ApiEndpoint, type ApiRequestBody, type ApiResponse, type SpecWarning } from '@apishield/contracts';
import { AppError } from '../../utils/errors.js';
import { sha256Hex, stableId } from '../../utils/ids.js';
import { sanitize } from '../../utils/sanitize.js';
import { resolveInternalRefs } from './refResolver.js';
import { buildSupportSummary, type SupportIssue } from './supportMatrix.js';
import {
  collectSecuritySchemes,
  effectiveSecurity,
  isHttpMethod,
  isMetadataKey,
  mergeParameters,
  parseVersion,
  serverCandidates,
  warning,
} from './versionRules.js';

export interface ParseSuccess {
  sourceHash: string;
  openapiVersion: string;
  title: string;
  endpoints: Omit<ApiEndpoint, 'id' | 'specificationId'>[];
  warnings: SpecWarning[];
  supportSummary: ReturnType<typeof buildSupportSummary>;
}

function countNodes(value: unknown, state: { count: number }): void {
  state.count += 1;
  if (state.count > LIMITS.documentNodeCount) {
    throw new AppError(400, 'DOCUMENT_TOO_COMPLEX', 'OpenAPI document exceeded the node-count bound.');
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      for (const item of value) {
        countNodes(item, state);
      }
    } else {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        countNodes(nested, state);
      }
    }
  }
}

export function parseOpenApiDocument(raw: string): ParseSuccess {
  if (Buffer.byteLength(raw, 'utf8') > LIMITS.openApiUploadBytes) {
    throw new AppError(413, 'UPLOAD_TOO_LARGE', 'OpenAPI document exceeds the 2 MiB limit.');
  }

  let parsed: unknown;
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      parsed = JSON.parse(trimmed);
    } else {
      parsed = parseYaml(trimmed, { maxAliasCount: 100, prettyErrors: true });
    }
  } catch {
    throw new AppError(400, 'PARSE_FAILED', 'The uploaded document is not valid YAML or JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError(400, 'INVALID_DOCUMENT', 'OpenAPI document must be an object.');
  }

  countNodes(parsed, { count: 0 });

  const document = parsed as Record<string, unknown>;
  const version = parseVersion(document.openapi);
  if (!version.raw) {
    throw new AppError(400, 'MISSING_VERSION', 'openapi version field is required.');
  }
  if (version.family === 'other') {
    throw new AppError(
      400,
      'UNSUPPORTED_VERSION',
      `OpenAPI ${version.raw} is outside the MVP discovery subset (3.0.x, 3.1.x, 3.2.x).`,
    );
  }

  const { resolved, warnings: refWarnings } = resolveInternalRefs(document);
  const issues: SupportIssue[] = [];
  const warnings: SpecWarning[] = refWarnings.map((message) => warning('REF_WARNING', message));

  const paths = resolved.paths;
  if (!paths || typeof paths !== 'object') {
    throw new AppError(400, 'MISSING_PATHS', 'OpenAPI document has no paths object.');
  }

  const securitySchemes = collectSecuritySchemes(resolved.components);
  const rootSecurity = resolved.security;
  const rootServers = resolved.servers;
  const endpoints: Omit<ApiEndpoint, 'id' | 'specificationId'>[] = [];

  const pathEntries = Object.entries(paths as Record<string, unknown>).sort(([a], [b]) => {
    const score = (path: string) => (path.includes('{') ? 1 : 0);
    const staticDiff = score(a) - score(b);
    return staticDiff !== 0 ? staticDiff : a.localeCompare(b);
  });

  for (const [pathTemplate, pathItem] of pathEntries) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }
    const item = pathItem as Record<string, unknown>;
    const operations: Array<{ method: string; operation: Record<string, unknown>; executable: boolean }> = [];

    for (const [key, value] of Object.entries(item)) {
      if (isMetadataKey(key) || !value || typeof value !== 'object') {
        continue;
      }
      if (isHttpMethod(key)) {
        operations.push({
          method: key,
          operation: value as Record<string, unknown>,
          executable: key.toLowerCase() !== 'query',
        });
      }
    }

    const additional = item.additionalOperations;
    if (additional && typeof additional === 'object') {
      for (const [name, value] of Object.entries(additional as Record<string, unknown>)) {
        if (value && typeof value === 'object') {
          operations.push({
            method: name,
            operation: value as Record<string, unknown>,
            executable: false,
          });
          issues.push({
            construct: 'additionalOperations',
            location: `${pathTemplate} ${name}`,
            reason: 'OpenAPI 3.2 additionalOperations are discovered but not executed.',
            affects: ['execution'],
          });
        }
      }
    }

    for (const { method, operation, executable } of operations) {
      if (method.toLowerCase() === 'query') {
        issues.push({
          construct: 'query',
          location: `${pathTemplate} query`,
          reason: 'OpenAPI 3.2 query operations are discovered but not executed.',
          affects: ['execution'],
        });
      }

      const parameters = mergeParameters(item.parameters, operation.parameters);
      const requestBody = extractRequestBody(operation.requestBody);
      const responses = extractResponses(operation.responses);
      const security = effectiveSecurity(rootSecurity, operation.security);
      const servers = serverCandidates(rootServers, item.servers, operation.servers);
      const endpointWarnings: SpecWarning[] = [];
      if (!executable) {
        endpointWarnings.push(
          warning('EXECUTION_UNSUPPORTED', 'This operation can be discovered but not executed in the MVP.', `${method} ${pathTemplate}`),
        );
      }

      const schemaKeywords = JSON.stringify(requestBody?.schema ?? {});
      if (schemaKeywords.includes('"oneOf"') || schemaKeywords.includes('"anyOf"') || schemaKeywords.includes('"allOf"')) {
        issues.push({
          construct: 'schema composition',
          location: `${method.toUpperCase()} ${pathTemplate}`,
          reason: 'Complex schema composition is preserved but generation may skip unsupported branches.',
          affects: ['generation'],
        });
      }

      endpoints.push({
        operationId: typeof operation.operationId === 'string' ? operation.operationId : undefined,
        pathTemplate,
        method,
        parameters,
        requestBody,
        responses,
        effectiveSecurity: security,
        securitySchemes,
        serverCandidates: servers,
        supportStatus: executable ? 'supported' : 'unsupported',
        warnings: endpointWarnings,
      });
    }
  }

  const title =
    resolved.info && typeof resolved.info === 'object'
      ? String((resolved.info as { title?: string }).title ?? 'Untitled API')
      : 'Untitled API';

  if (endpoints.length === 0) {
    warnings.push(warning('NO_OPERATIONS', 'The document is valid but contains no discoverable operations.'));
  }

  return {
    sourceHash: sha256Hex(raw),
    openapiVersion: version.raw,
    title,
    endpoints: sanitize(endpoints) as typeof endpoints,
    warnings,
    supportSummary: buildSupportSummary(version.family, issues, endpoints.length),
  };
}

function extractRequestBody(value: unknown): ApiRequestBody | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const content = record.content;
  if (!content || typeof content !== 'object') {
    return { required: Boolean(record.required), contentType: 'application/json' };
  }
  const entries = Object.entries(content as Record<string, Record<string, unknown>>);
  const json = entries.find(([type]) => type.includes('json')) ?? entries[0];
  if (!json) {
    return { required: Boolean(record.required), contentType: 'application/json' };
  }
  const [contentType, media] = json;
  if (contentType && !contentType.includes('json') && contentType !== 'application/x-www-form-urlencoded') {
    return {
      required: Boolean(record.required),
      contentType,
      schema: media.schema as Record<string, unknown> | undefined,
      example: media.example,
    };
  }
  return {
    required: Boolean(record.required),
    contentType,
    schema: media.schema as Record<string, unknown> | undefined,
    example: media.example,
  };
}

function extractResponses(value: unknown): Record<string, ApiResponse> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const output: Record<string, ApiResponse> = {};
  for (const [code, response] of Object.entries(value as Record<string, Record<string, unknown>>)) {
    if (!response || typeof response !== 'object') {
      continue;
    }
    const content = response.content as Record<string, Record<string, unknown>> | undefined;
    const first = content ? Object.entries(content)[0] : undefined;
    output[code] = {
      description: typeof response.description === 'string' ? response.description : undefined,
      contentType: first?.[0],
      schema: first?.[1]?.schema as Record<string, unknown> | undefined,
    };
  }
  return output;
}

export function assignEndpointIds(
  specificationId: string,
  sourceHash: string,
  endpoints: Omit<ApiEndpoint, 'id' | 'specificationId'>[],
): ApiEndpoint[] {
  return endpoints.map((endpoint) => ({
    ...endpoint,
    specificationId,
    id: stableId(sourceHash, endpoint.method.toLowerCase(), endpoint.pathTemplate),
  }));
}
