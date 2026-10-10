import type { RequestTemplate, SafetyClass, ScannerName, TestCase, TestVariant } from '@apishield/contracts';
import { stableId } from '../../utils/ids.js';
import type { AnalyzedRoute } from './routeAnalyzer.js';

export const ADHOC_CREDENTIAL_REFERENCE = 'adhoc.primary';

export type AdhocRole =
  | 'baseline'
  | 'bola_neighbor'
  | 'bola_boundary'
  | 'invalid_id'
  | 'auth_none'
  | 'auth_invalid'
  | 'auth_malformed'
  | 'cors'
  | 'options';

export interface AdhocProbe {
  role: AdhocRole;
  testCase: TestCase;
  /** Headers merged on top of the template for this probe only (e.g. a bad token). */
  extraHeaders?: Record<string, string>;
  /** For object-level probes: the object id this probe requested. */
  objectId?: string;
}

const MAX_NEIGHBORS = 3;

/**
 * Deterministic, bounded security test cases for one route. No randomness, no
 * unbounded fuzzing, and every case records the property it probes. Mutating
 * object-level and boundary probes are only generated for safe methods so an
 * ad-hoc run never deletes or rewrites a neighbour's object.
 */
export function generateAdhocProbes(route: AnalyzedRoute, endpointId: string): AdhocProbe[] {
  const probes: AdhocProbe[] = [];
  const authRef = route.authorizationHeader ? ADHOC_CREDENTIAL_REFERENCE : null;
  const baseSafety: SafetyClass = route.safeMethod
    ? 'read_only'
    : route.method === 'DELETE'
      ? 'destructive'
      : 'mutating';

  const template = (overrides?: Partial<RequestTemplate>): RequestTemplate => ({
    method: route.method,
    pathTemplate: route.endpoint.pathTemplate,
    pathValues: { ...route.pathValues },
    query: { ...route.query },
    headers: { ...route.headers },
    ...(route.body !== undefined ? { body: route.body } : {}),
    ...overrides,
  });

  const push = (
    role: AdhocRole,
    variant: TestVariant,
    scanner: ScannerName,
    requestTemplate: RequestTemplate,
    options: {
      authContextId: string | null;
      safetyClass?: SafetyClass;
      eligible?: boolean;
      ineligibleReason?: string;
      expectedBehavior: string;
      mutation?: TestCase['mutation'];
      extraHeaders?: Record<string, string>;
      objectId?: string;
    },
  ): void => {
    const eligible = options.eligible ?? true;
    probes.push({
      role,
      extraHeaders: options.extraHeaders,
      objectId: options.objectId,
      testCase: {
        id: stableId(endpointId, 'adhoc', role, options.objectId ?? '-', options.authContextId ?? 'anon'),
        endpointId,
        scanner,
        variant,
        authContextId: options.authContextId,
        requestTemplate,
        mutation: options.mutation ?? null,
        prerequisites: [],
        expectedBehavior: options.expectedBehavior,
        safetyClass: options.safetyClass ?? baseSafety,
        executionEligibility: eligible
          ? { eligible: true }
          : { eligible: false, reason: options.ineligibleReason ?? 'Not executed by default.' },
      },
    });
  };

  // 1. Normal request — establishes the legitimate baseline.
  push('baseline', 'valid', route.objectIdParameter ? 'bola' : 'authentication', template(), {
    authContextId: authRef,
    expectedBehavior: 'Baseline request with the supplied credential and parameters.',
  });

  const idParam = route.objectIdParameter;
  if (idParam && route.safeMethod) {
    const current = Number(idParam.value);

    // 2. Cross-object access with the same credential (object-level authorization).
    const neighbors = uniqueNeighbors(current).slice(0, MAX_NEIGHBORS);
    for (const neighbor of neighbors) {
      push('bola_neighbor', 'other_user', 'bola', template({ pathValues: { ...route.pathValues, [idParam.name]: String(neighbor) } }), {
        authContextId: authRef,
        objectId: String(neighbor),
        mutation: {
          target: idParam.name,
          kind: 'other_object',
          description: `Request object id ${neighbor} using the same credential that owns id ${idParam.value}.`,
        },
        expectedBehavior: `Should be denied (401/403/404) unless id ${neighbor} is owned by or shared with the caller.`,
      });
    }

    // 3. Boundary object ids.
    for (const boundary of ['0', '999999']) {
      push('bola_boundary', 'boundary', 'bola', template({ pathValues: { ...route.pathValues, [idParam.name]: boundary } }), {
        authContextId: authRef,
        objectId: boundary,
        mutation: { target: idParam.name, kind: 'boundary', description: `Boundary object id ${boundary}.` },
        expectedBehavior: 'Should return a controlled 400/404 rather than an error or another object.',
      });
    }

    // 4. Malformed id — probes input validation and error verbosity.
    push('invalid_id', 'invalid', 'misconfiguration', template({ pathValues: { ...route.pathValues, [idParam.name]: 'not-a-number' } }), {
      authContextId: authRef,
      mutation: { target: idParam.name, kind: 'malformed', description: 'Non-numeric value for an id parameter.' },
      expectedBehavior: 'Should return a controlled 400 without a stack trace or internal detail.',
    });
  } else if (idParam && !route.safeMethod) {
    push('bola_neighbor', 'other_user', 'bola', template(), {
      authContextId: authRef,
      eligible: false,
      ineligibleReason: `Object-level probing is not executed for ${route.method} to avoid modifying another object.`,
      expectedBehavior: 'Cross-object checks run only for safe methods.',
    });
  }

  // 5. Authentication handling — only meaningful when a credential was supplied.
  if (route.authorizationHeader) {
    push('auth_none', 'no_credential', 'authentication', template(), {
      authContextId: null,
      expectedBehavior: 'A protected route should reject a request with no credential (401/403).',
    });
    push('auth_invalid', 'invalid_credential', 'authentication', template(), {
      authContextId: null,
      extraHeaders: { authorization: 'Bearer invalid-token-apishield-probe' },
      expectedBehavior: 'An invalid bearer token should be rejected (401/403).',
    });
    push('auth_malformed', 'malformed_credential', 'authentication', template(), {
      authContextId: null,
      extraHeaders: { authorization: 'NotBearer malformed-apishield-probe' },
      expectedBehavior: 'A malformed Authorization header should be rejected (401/403).',
    });
  }

  // 6. Security misconfiguration probes (always read-only, regardless of method).
  push('cors', 'untrusted_origin', 'misconfiguration', template({ method: 'GET', headers: { ...route.headers, origin: 'https://evil.example' } }), {
    authContextId: null,
    safetyClass: 'read_only',
    extraHeaders: { origin: 'https://evil.example' },
    expectedBehavior: 'An untrusted Origin should not be reflected together with credentialed CORS headers.',
  });
  push('options', 'unexpected_method', 'misconfiguration', template({ method: 'OPTIONS' }), {
    authContextId: null,
    safetyClass: 'read_only',
    expectedBehavior: 'OPTIONS advertises allowed methods; observed only, not treated as an executable exploit.',
  });

  return probes.sort((a, b) => a.testCase.id.localeCompare(b.testCase.id));
}

function uniqueNeighbors(current: number): number[] {
  if (!Number.isFinite(current)) {
    return [];
  }
  const candidates = [current + 1, current - 1, current + 2];
  const seen = new Set<number>();
  const output: number[] = [];
  for (const value of candidates) {
    if (value > 0 && value !== current && !seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }
  return output;
}
