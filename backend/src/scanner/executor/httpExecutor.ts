import type { ExecutionResult, RequestTemplate, TargetProfile } from '@apishield/contracts';
import { getCredential } from '../../config/credentialStore.js';
import { newId, nowIso, monotonicMs } from '../../utils/ids.js';
import { redactUrl, sanitize, sanitizeHeaders } from '../../utils/sanitize.js';
import { serializeRequest } from '../generator/serialization.js';
import { assertTargetAllowed } from './targetPolicy.js';
import { readBoundedBody } from './bodyReader.js';
import type { ScanBudget } from './budget.js';
import type { LookupFn } from './dnsGuard.js';

export interface ExecuteOptions {
  scanId: string;
  testCaseId: string;
  endpointId: string;
  authContextId: string | null;
  template: RequestTemplate;
  profile: TargetProfile;
  budget: ScanBudget;
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
  lookupFn?: LookupFn;
  fetchImpl?: typeof fetch;
}

export interface ExecuteRuntime {
  execution: ExecutionResult;
  runtimeValues: Record<string, string>;
}

export async function executeRequest(options: ExecuteOptions): Promise<ExecutionResult> {
  const runtime = await executeRequestRuntime(options);
  return runtime.execution;
}

export async function executeRequestRuntime(options: ExecuteOptions): Promise<ExecuteRuntime> {
  const id = newId();
  const startedAt = nowIso();
  const startedMs = monotonicMs();

  const wrap = (execution: ExecutionResult, runtimeValues: Record<string, string> = {}): ExecuteRuntime => ({
    execution,
    runtimeValues,
  });

  const notExecuted = (
    outcome: ExecutionResult['outcome'],
    errorCode: string,
    redactedUrl = '',
  ): ExecutionResult => ({
    id,
    scanId: options.scanId,
    testCaseId: options.testCaseId,
    endpointId: options.endpointId,
    authContextId: options.authContextId,
    startedAt,
    durationMs: Math.max(0, monotonicMs() - startedMs),
    request: { method: options.template.method.toUpperCase(), redactedUrl, redactedHeaders: {}, redactedBody: null },
    response: { status: null, redactedHeaders: {}, redactedBody: null },
    outcome,
    errorCode,
    bodyTruncated: false,
    observedBytes: 0,
  });

  if (options.signal?.aborted) {
    return wrap(notExecuted('cancelled', 'CANCELLED'));
  }
  const acquired = await options.budget.acquire();
  if (!acquired) {
    return wrap(notExecuted('not_executed_budget', 'BUDGET'));
  }

  try {
    const serialized = serializeRequest(options.template, options.profile.approvedOrigin, options.profile.basePath);
    await assertTargetAllowed(serialized.url, options.profile, options.lookupFn);

    const headers = new Headers();
    for (const [key, value] of Object.entries({ ...serialized.headers, ...options.extraHeaders })) {
      headers.set(key, value);
    }
    if (options.authContextId) {
      const credential = getCredential(options.scanId, options.authContextId);
      if (credential) {
        headers.set('authorization', credential.authorizationHeader);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.profile.executionLimits.httpTimeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const init: RequestInit = {
      method: serialized.method,
      headers,
      redirect: 'manual',
      signal: controller.signal,
    };
    if (serialized.body !== undefined && serialized.method !== 'GET' && serialized.method !== 'HEAD') {
      if (Buffer.byteLength(serialized.body) > options.profile.executionLimits.maxRequestBodyBytes) {
        return wrap(notExecuted('blocked_by_policy', 'REQUEST_BODY_TOO_LARGE', redactUrl(serialized.url)));
      }
      init.body = serialized.body;
    }

    try {
      const fetchImpl = options.fetchImpl ?? fetch;
      const response = await fetchImpl(serialized.url, init);
      if (response.status === 429) {
        options.budget.noteThrottle();
      }
      const { text, truncated, observedBytes } = await readBoundedBody(
        response,
        options.profile.executionLimits.maxCapturedResponseBytes,
      );
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      const runtimeValues = extractRuntimeValues(text);
      return wrap(
        {
          id,
          scanId: options.scanId,
          testCaseId: options.testCaseId,
          endpointId: options.endpointId,
          authContextId: options.authContextId,
          startedAt,
          durationMs: Math.max(0, monotonicMs() - startedMs),
          request: {
            method: serialized.method,
            redactedUrl: redactUrl(serialized.url),
            redactedHeaders: sanitizeHeaders(Object.fromEntries(headers.entries())),
            redactedBody: sanitize(options.template.body ?? null),
          },
          response: {
            status: response.status,
            redactedHeaders: sanitizeHeaders(responseHeaders),
            redactedBody: parseBody(text),
          },
          outcome: 'response',
          bodyTruncated: truncated,
          observedBytes,
        },
        runtimeValues,
      );
    } catch (error) {
      const aborted = options.signal?.aborted || (error instanceof Error && error.name === 'AbortError');
      return wrap({
        id,
        scanId: options.scanId,
        testCaseId: options.testCaseId,
        endpointId: options.endpointId,
        authContextId: options.authContextId,
        startedAt,
        durationMs: Math.max(0, monotonicMs() - startedMs),
        request: {
          method: serialized.method,
          redactedUrl: redactUrl(serialized.url),
          redactedHeaders: sanitizeHeaders(Object.fromEntries(headers.entries())),
          redactedBody: sanitize(options.template.body ?? null),
        },
        response: { status: null, redactedHeaders: {}, redactedBody: null },
        outcome: aborted ? 'timeout' : 'transport_error',
        errorCode: aborted ? 'TIMEOUT_OR_CANCELLED' : 'TRANSPORT',
        bodyTruncated: false,
        observedBytes: 0,
      });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
    }
  } catch {
    return wrap(notExecuted('blocked_by_policy', 'POLICY'));
  } finally {
    options.budget.release();
  }
}

function extractRuntimeValues(text: string): Record<string, string> {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const output: Record<string, string> = {};
    if (typeof parsed.token === 'string') {
      output.token = parsed.token;
    }
    return output;
  } catch {
    return {};
  }
}

function parseBody(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return sanitize(JSON.parse(text));
  } catch {
    return sanitize(text);
  }
}
