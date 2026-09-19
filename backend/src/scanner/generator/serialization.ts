import { LIMITS } from '@apishield/contracts';
import type { ApiParameter, RequestTemplate } from '@apishield/contracts';

export function serializeRequest(template: RequestTemplate, origin: string, basePath: string): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
} {
  let path = template.pathTemplate;
  if (template.omitPathParameter) {
    path = path.replace(`{${template.omitPathParameter}}`, '').replace('//', '/');
  } else {
    for (const [name, value] of Object.entries(template.pathValues)) {
      path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
    }
  }

  const originUrl = new URL(origin);
  const normalizedBase = basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
  const combinedPath = `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/{2,}/g, '/');
  const url = new URL(combinedPath, originUrl);
  for (const [key, value] of Object.entries(template.query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else {
      url.searchParams.set(key, value);
    }
  }

  const href = url.toString();
  if (href.length > LIMITS.maxUrlLength) {
    throw new Error('URL_TOO_LONG');
  }

  const headers = { ...template.headers };
  let body: string | undefined;
  if (template.body !== undefined) {
    body = typeof template.body === 'string' ? template.body : JSON.stringify(template.body);
    headers['content-type'] ??= 'application/json';
  }
  return { url: href, method: template.method.toUpperCase(), headers, body };
}

export function applyParameter(
  template: RequestTemplate,
  parameter: ApiParameter,
  value: unknown,
): void {
  const serialized = value === undefined || value === null ? '' : String(value);
  if (parameter.location === 'path') {
    template.pathValues[parameter.name] = serialized;
  } else if (parameter.location === 'query') {
    template.query[parameter.name] = serialized;
  } else if (parameter.location === 'header') {
    template.headers[parameter.name] = serialized;
  }
}
