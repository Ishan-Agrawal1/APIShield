import type { ApiEndpoint, ExecutionResult, Finding } from '@apishield/contracts';
import { newId, nowIso } from '../../utils/ids.js';
import { executeRequest } from '../executor/httpExecutor.js';
import { securityRequiresAuth } from '../parser/versionRules.js';
import { authSeverity } from '../analyzer/severity.js';
import { buildDedupKey } from '../analyzer/dedupKey.js';
import type { ScannerOutput, ScannerRunContext } from '../authorization/bolaScanner.js';
import { getCredential } from '../../config/credentialStore.js';

export async function runAuthScanner(
  endpoints: ApiEndpoint[],
  context: ScannerRunContext,
): Promise<ScannerOutput> {
  const findings: Finding[] = [];
  const executions: ExecutionResult[] = [];
  let planned = 0;
  let executed = 0;
  let outcome: ScannerOutput['coverage']['outcome'] = 'no_finding';
  let reason: string | undefined;

  const protectedEndpoints: ApiEndpoint[] = [
    ...endpoints.filter(
      (endpoint) =>
        endpoint.supportStatus === 'supported' &&
        ['get', 'head'].includes(endpoint.method.toLowerCase()) &&
        securityRequiresAuth(endpoint.effectiveSecurity),
    ),
    ...(context.profile.authenticationProbes ?? []).map((probe) => ({
      id: `probe:${probe.method}:${probe.pathTemplate}`,
      specificationId: 'probe',
      pathTemplate: probe.pathTemplate,
      method: probe.method,
      parameters: [],
      responses: {},
      effectiveSecurity: [{ bearerAuth: [] }],
      securitySchemes: {},
      serverCandidates: [],
      supportStatus: 'supported' as const,
      warnings: [],
    })),
  ];

  for (const endpoint of protectedEndpoints) {
    const template = {
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      pathValues: Object.fromEntries(
        endpoint.parameters
          .filter((parameter) => parameter.location === 'path')
          .map((parameter) => [parameter.name, String(parameter.example ?? parameter.default ?? '1')]),
      ),
      query: {},
      headers: {},
    };

    const baseline = await executeRequest({
      scanId: context.scanId,
      testCaseId: `auth-valid-${endpoint.id}`,
      endpointId: endpoint.id,
      authContextId: 'demo.userA',
      template,
      profile: context.profile,
      budget: context.budget,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
    });
    executions.push(baseline);
    planned += 4;
    executed += baseline.outcome === 'response' ? 1 : 0;
    if (baseline.outcome !== 'response' || baseline.response.status !== 200) {
      continue;
    }

    const variants: Array<{ id: string; extra?: Record<string, string>; auth: string | null; skipIf?: boolean }> = [
      { id: 'none', auth: null },
      { id: 'invalid', auth: null, extra: { authorization: 'Bearer not-a-valid-token' } },
      { id: 'malformed', auth: null, extra: { authorization: 'NotBearer abc' } },
      { id: 'expired', auth: 'demo.expired' },
    ];

    for (const variant of variants) {
      if (variant.id === 'expired' && !getCredential(context.scanId, 'demo.expired')) {
        reason = 'Expired credential fixture is unavailable.';
        if (outcome === 'no_finding') {
          outcome = 'skipped';
        }
        continue;
      }
      const result = await executeRequest({
        scanId: context.scanId,
        testCaseId: `auth-${variant.id}-${endpoint.id}`,
        endpointId: endpoint.id,
        authContextId: variant.auth,
        template,
        profile: context.profile,
        budget: context.budget,
        extraHeaders: variant.extra,
        signal: context.signal,
        fetchImpl: context.fetchImpl,
      });
      executions.push(result);
      executed += result.outcome === 'response' ? 1 : 0;
      if (result.outcome !== 'response' || result.bodyTruncated) {
        continue;
      }
      if (result.response.status === 401 || result.response.status === 403) {
        continue;
      }
      if (result.response.status === 200 && exposesProtected(result.response.redactedBody, baseline.response.redactedBody)) {
        findings.push({
          id: newId(),
          scanId: context.scanId,
          ruleId: 'AUTH_BYPASS',
          vulnerability: 'API2:2023 Broken Authentication',
          severity: authSeverity('confirmed'),
          confidence: 'confirmed',
          endpointId: endpoint.id,
          endpoint: endpoint.pathTemplate,
          method: endpoint.method.toUpperCase(),
          description: `Protected operation ${endpoint.method.toUpperCase()} ${endpoint.pathTemplate} exposed protected data without valid authentication (${variant.id}).`,
          evidence: {
            summary: 'Authentication bypass',
            requests: [
              { method: baseline.request.method, redactedUrl: baseline.request.redactedUrl, status: baseline.response.status },
              { method: result.request.method, redactedUrl: result.request.redactedUrl, status: result.response.status, excerpt: result.response.redactedBody },
            ],
            conclusion: `Variant ${variant.id} returned protected behavior without a valid credential.`,
          },
          executionIds: [baseline.id, result.id],
          remediation: 'Reject missing, invalid, malformed, and expired credentials before serving protected resources.',
          dedupKey: buildDedupKey({
            ruleId: 'AUTH_BYPASS',
            endpointId: endpoint.id,
            authPair: variant.id,
          }),
          createdAt: nowIso(),
          analysisMode: 'rule_based',
        });
        outcome = 'finding';
      }
    }
  }

  return {
    findings,
    executions,
    coverage: { scanner: 'authentication', outcome, reason, casesPlanned: planned, casesExecuted: executed },
  };
}

function exposesProtected(actual: unknown, baseline: unknown): boolean {
  if (!actual || typeof actual !== 'object') {
    return false;
  }
  const actualRecord = actual as Record<string, unknown>;
  const baselineRecord = baseline && typeof baseline === 'object' ? (baseline as Record<string, unknown>) : {};
  const keys = ['id', 'email', 'userId', 'title', 'content', 'role'];
  return keys.some((key) => actualRecord[key] !== undefined && baselineRecord[key] !== undefined);
}
