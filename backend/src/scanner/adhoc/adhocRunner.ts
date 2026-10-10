import type {
  ApiEndpoint,
  CheckOutcome,
  Confidence,
  ExecutionResult,
  Finding,
  ScannerName,
  Severity,
  TargetProfile,
} from '@apishield/contracts';
import { SEVERITIES, CONFIDENCES } from '@apishield/contracts';
import { clearCredentials, createCredentialStore, setCredential } from '../../config/credentialStore.js';
import { defaultExecutionLimits } from '../../config/limits.js';
import { newId, nowIso } from '../../utils/ids.js';
import { ScanModel } from '../../models/Scan.js';
import { persistExecutions, persistFindings } from '../../services/findingService.js';
import { attachAiAnalysis } from '../../services/ai/aiService.js';
import { ScanBudget } from '../executor/budget.js';
import { executeRequest } from '../executor/httpExecutor.js';
import { bodyLooksLikeLoginPage, genericErrorBody, selectValue } from '../analyzer/responseAnalyzer.js';
import { authSeverity, bolaSeverity, misconfigSeverity } from '../analyzer/severity.js';
import { buildDedupKey } from '../analyzer/dedupKey.js';
import { progressFromCounts, summarizeCoverage } from '../engine/coverage.js';
import { ADHOC_CREDENTIAL_REFERENCE, generateAdhocProbes, type AdhocProbe } from './adhocGenerator.js';
import type { AnalyzedRoute } from './routeAnalyzer.js';

const OWNER_KEYS = ['userId', 'ownerId', 'owner', 'user_id', 'ownerPrincipalId', 'accountId', 'authorId'];
const ID_KEYS = ['id', '_id', 'noteId', 'objectId', 'uuid'];
const PROTECTED_KEYS = ['id', 'email', 'userId', 'title', 'content', 'role', 'name', 'ownerId'];
const STACK_TRACE = /(\bstack\b|\btrace\b|\n\s*at\s+\S|Error:\s|Exception|ECONNREFUSED|\/node_modules\/|\\node_modules\\)/i;

export interface AdhocRunOptions {
  scanId: string;
  endpoint: ApiEndpoint;
  route: AnalyzedRoute;
  enabledScanners: ScannerName[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export function synthesizeAdhocProfile(route: AnalyzedRoute): TargetProfile {
  const methods = new Set<string>(['GET', 'HEAD', 'OPTIONS', route.method]);
  return {
    id: 'adhoc',
    label: `Ad-hoc route (${route.origin})`,
    approvedOrigin: route.origin,
    basePath: '',
    pathScopePrefixes: ['/'],
    approvedMethods: [...methods],
    executionLimits: defaultExecutionLimits(),
    credentialReferences: route.authorizationHeader ? [ADHOC_CREDENTIAL_REFERENCE] : [],
    accessPolicy: { principals: [], objects: [], rules: [] },
    bolaCases: [],
    supportedAuthentication: ['http-bearer'],
    optionalCheckSettings: { resourceObservations: false, corsBrowserConfirmation: false },
  };
}

export async function runAdhocScan(options: AdhocRunOptions): Promise<void> {
  const { scanId, endpoint, route, enabledScanners } = options;
  const profile = synthesizeAdhocProfile(route);
  createCredentialStore(scanId);
  if (route.authorizationHeader) {
    setCredential(scanId, { reference: ADHOC_CREDENTIAL_REFERENCE, authorizationHeader: route.authorizationHeader });
  }
  const budget = new ScanBudget({
    maxAttempts: profile.executionLimits.maxHttpAttempts,
    maxConcurrent: profile.executionLimits.concurrentTargetRequests,
    maxStartsPerSecond: profile.executionLimits.maxTargetRequestStartsPerSecond,
    maxDurationMs: profile.executionLimits.maxScanDurationMs,
  });

  try {
    await ScanModel.updateOne({ _id: scanId }, { $set: { status: 'running' } });

    const probes = generateAdhocProbes(route, endpoint.id).filter(
      (probe) => probe.role === 'baseline' || enabledScanners.includes(probe.testCase.scanner),
    );

    const executions: ExecutionResult[] = [];
    const byRole = new Map<string, ExecutionResult[]>();
    for (const probe of probes) {
      if (options.signal?.aborted) {
        break;
      }
      if (!probe.testCase.executionEligibility.eligible) {
        continue;
      }
      const result = await executeRequest({
        scanId,
        testCaseId: probe.testCase.id,
        endpointId: endpoint.id,
        authContextId: probe.testCase.authContextId,
        template: probe.testCase.requestTemplate,
        profile,
        budget,
        ...(probe.extraHeaders ? { extraHeaders: probe.extraHeaders } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });
      executions.push(result);
      const bucket = byRole.get(probe.role) ?? [];
      bucket.push(result);
      byRole.set(probe.role, bucket);
    }

    const baseline = byRole.get('baseline')?.[0];
    const findings: Finding[] = [];
    const coverage: Array<{ scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number }> = [];

    if (enabledScanners.includes('bola')) {
      coverage.push(analyzeBola(scanId, endpoint, route, baseline, byRole, findings));
    }
    if (enabledScanners.includes('authentication')) {
      coverage.push(analyzeAuth(scanId, endpoint, route, baseline, byRole, findings));
    }
    if (enabledScanners.includes('misconfiguration')) {
      coverage.push(analyzeMisconfig(scanId, endpoint, baseline, byRole, findings));
    }

    await persistExecutions(executions);
    const enriched = await attachAiAnalysis(findings);
    await persistFindings(enriched);

    const totals = coverage.reduce(
      (acc, row) => {
        acc.planned += row.casesPlanned;
        acc.executed += row.casesExecuted;
        if (row.outcome === 'skipped') {
          acc.skipped += Math.max(0, row.casesPlanned - row.casesExecuted);
        }
        if (row.outcome === 'error') {
          acc.errored += 1;
        }
        return acc;
      },
      { planned: 0, executed: 0, skipped: 0, errored: 0 },
    );
    const summary = emptyFindingSummary();
    for (const finding of enriched) {
      summary.findingsBySeverity[finding.severity] += 1;
      summary.findingsByConfidence[finding.confidence] += 1;
    }
    const terminal = options.signal?.aborted ? 'cancelled' : summarizeCoverage(coverage).status;

    await ScanModel.updateOne(
      { _id: scanId, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: terminal,
          completedAt: nowIso(),
          progress: progressFromCounts(totals.planned, totals.executed, totals.skipped, totals.errored),
          coverage,
          summary,
        },
      },
    );
  } catch (error) {
    const aborted = Boolean(options.signal?.aborted);
    await ScanModel.updateOne(
      { _id: scanId, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: aborted ? 'cancelled' : 'failed',
          completedAt: nowIso(),
          errorLog: aborted ? [] : [{ code: 'SCAN_FAILED', message: error instanceof Error ? error.message : 'Scan failed' }],
        },
      },
    );
  } finally {
    clearCredentials(scanId);
  }
}

function analyzeBola(
  scanId: string,
  endpoint: ApiEndpoint,
  route: AnalyzedRoute,
  baseline: ExecutionResult | undefined,
  byRole: Map<string, ExecutionResult[]>,
  findings: Finding[],
): { scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number } {
  const neighbors = byRole.get('bola_neighbor') ?? [];
  const boundaries = byRole.get('bola_boundary') ?? [];
  const planned = neighbors.length + boundaries.length;
  const executed = [...neighbors, ...boundaries].filter((item) => item.outcome === 'response').length;
  const idParam = route.objectIdParameter;

  if (!idParam) {
    return { scanner: 'bola', outcome: 'skipped', reason: 'No object id parameter was present in the route.', casesPlanned: 0, casesExecuted: 0 };
  }
  if (!route.safeMethod) {
    return { scanner: 'bola', outcome: 'skipped', reason: `Object-level checks are not executed for ${route.method}.`, casesPlanned: planned, casesExecuted: executed };
  }
  if (!usableObjectResponse(baseline)) {
    return { scanner: 'bola', outcome: 'inconclusive', reason: 'The baseline request did not return a usable object (expected HTTP 200 with a body).', casesPlanned: planned, casesExecuted: executed };
  }

  const baselineOwner = ownerValue(baseline.response.redactedBody);
  const baselineId = idValue(baseline.response.redactedBody);
  const bypassing: ExecutionResult[] = [];
  let confidence: Confidence = 'potential';

  for (const neighbor of neighbors) {
    if (!usableObjectResponse(neighbor)) {
      continue;
    }
    const neighborId = idValue(neighbor.response.redactedBody);
    const neighborOwner = ownerValue(neighbor.response.redactedBody);
    const differentObject =
      (neighborId !== undefined && baselineId !== undefined && String(neighborId) !== String(baselineId)) ||
      requestedObjectId(neighbor, idParam.name) !== idParam.value;
    if (!differentObject) {
      continue;
    }
    bypassing.push(neighbor);
    if (
      baselineOwner !== undefined &&
      neighborOwner !== undefined &&
      String(neighborOwner) !== String(baselineOwner)
    ) {
      // The credential that owns the baseline object received an object owned
      // by a different principal: a demonstrated cross-user object read.
      confidence = 'confirmed';
    }
  }

  if (bypassing.length === 0) {
    return { scanner: 'bola', outcome: 'no_finding', casesPlanned: planned, casesExecuted: executed };
  }

  const severity: Severity = confidence === 'confirmed' ? bolaSeverity('confirmed') : 'medium';
  findings.push({
    id: newId(),
    scanId,
    ruleId: 'BOLA_READ_CROSS_OBJECT',
    vulnerability: 'API1:2023 Broken Object Level Authorization',
    severity,
    confidence,
    endpointId: endpoint.id,
    endpoint: endpoint.pathTemplate,
    method: endpoint.method.toUpperCase(),
    parameter: idParam.name,
    description: `The same credential retrieved object id(s) ${bypassing.map((item) => requestedObjectId(item, idParam.name)).join(', ')} in addition to the baseline object id ${idParam.value}.`,
    evidence: {
      summary: `Object-level access: ${endpoint.method.toUpperCase()} ${endpoint.pathTemplate}`,
      policy: { baselineObjectId: idParam.value, baselineOwner: baselineOwner ?? null },
      requests: [
        requestEvidence(baseline),
        ...bypassing.map((item) => requestEvidence(item)),
      ],
      objectIdentity: { accessedObjectIds: bypassing.map((item) => requestedObjectId(item, idParam.name)) },
      conclusion:
        confidence === 'confirmed'
          ? 'A credential received an object owned by a different principal, so object-level authorization is not enforced.'
          : 'The same credential received multiple distinct objects by changing the id. If these objects are not all owned by or shared with the caller, object-level authorization is missing. Confirm ownership to rule out shared/public objects.',
    },
    executionIds: [baseline.id, ...bypassing.map((item) => item.id)],
    remediation: 'Verify that the authenticated principal is authorized for the requested object before returning it.',
    dedupKey: buildDedupKey({ ruleId: 'BOLA_READ_CROSS_OBJECT', endpointId: endpoint.id, parameter: idParam.name }),
    createdAt: nowIso(),
    analysisMode: 'rule_based',
  });
  return { scanner: 'bola', outcome: 'finding', casesPlanned: planned, casesExecuted: executed };
}

function analyzeAuth(
  scanId: string,
  endpoint: ApiEndpoint,
  route: AnalyzedRoute,
  baseline: ExecutionResult | undefined,
  byRole: Map<string, ExecutionResult[]>,
  findings: Finding[],
): { scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number } {
  const variants: Array<{ role: string; label: string }> = [
    { role: 'auth_none', label: 'no credential' },
    { role: 'auth_invalid', label: 'invalid token' },
    { role: 'auth_malformed', label: 'malformed Authorization header' },
  ];
  const results = variants
    .map((variant) => ({ ...variant, result: byRole.get(variant.role)?.[0] }))
    .filter((item): item is { role: string; label: string; result: ExecutionResult } => Boolean(item.result));
  const planned = results.length;
  const executed = results.filter((item) => item.result.outcome === 'response').length;

  if (!route.authorizationHeader) {
    return { scanner: 'authentication', outcome: 'skipped', reason: 'No credential was supplied, so authentication handling could not be compared against an authenticated baseline.', casesPlanned: 0, casesExecuted: 0 };
  }
  if (!usableObjectResponse(baseline)) {
    return { scanner: 'authentication', outcome: 'inconclusive', reason: 'The authenticated baseline did not return HTTP 200 with a body.', casesPlanned: planned, casesExecuted: executed };
  }

  const bypassing = results.filter(
    (item) =>
      item.result.outcome === 'response' &&
      !item.result.bodyTruncated &&
      item.result.response.status === 200 &&
      exposesProtected(item.result.response.redactedBody, baseline.response.redactedBody),
  );

  if (bypassing.length === 0) {
    return { scanner: 'authentication', outcome: 'no_finding', casesPlanned: planned, casesExecuted: executed };
  }

  findings.push({
    id: newId(),
    scanId,
    ruleId: 'AUTH_WEAK_ENFORCEMENT',
    vulnerability: 'API2:2023 Broken Authentication',
    severity: authSeverity('potential'),
    confidence: 'potential',
    endpointId: endpoint.id,
    endpoint: endpoint.pathTemplate,
    method: endpoint.method.toUpperCase(),
    description: `The route returned the same protected shape without valid authentication (${bypassing.map((item) => item.label).join(', ')}).`,
    evidence: {
      summary: 'Authentication may not be enforced',
      requests: [requestEvidence(baseline), ...bypassing.map((item) => requestEvidence(item.result))],
      conclusion:
        'The route responded with protected data when the credential was removed or invalidated. If this route is intentionally public, this is expected and not a vulnerability; otherwise it indicates missing authentication enforcement.',
    },
    executionIds: [baseline.id, ...bypassing.map((item) => item.result.id)],
    remediation: 'Reject missing, invalid, malformed, and expired credentials before serving protected resources.',
    dedupKey: buildDedupKey({ ruleId: 'AUTH_WEAK_ENFORCEMENT', endpointId: endpoint.id }),
    createdAt: nowIso(),
    analysisMode: 'rule_based',
  });
  return { scanner: 'authentication', outcome: 'finding', casesPlanned: planned, casesExecuted: executed };
}

function analyzeMisconfig(
  scanId: string,
  endpoint: ApiEndpoint,
  baseline: ExecutionResult | undefined,
  byRole: Map<string, ExecutionResult[]>,
  findings: Finding[],
): { scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number } {
  const cors = byRole.get('cors')?.[0];
  const options = byRole.get('options')?.[0];
  const errorProbes = [...(byRole.get('invalid_id') ?? []), ...(byRole.get('bola_boundary') ?? [])];
  const executed = [baseline, cors, options, ...errorProbes].filter((item) => item?.outcome === 'response').length;
  const planned = [baseline, cors, options, ...errorProbes].filter(Boolean).length;

  const disclosure = baseline ? headerValue(baseline, 'server') ?? headerValue(baseline, 'x-powered-by') : undefined;
  if (baseline?.outcome === 'response' && disclosure) {
    findings.push(
      misconfigFinding(scanId, endpoint, 'SERVER_VERSION_DISCLOSURE', 'informational', 'potential', {
        summary: 'Server or framework version disclosed',
        requests: [{ ...requestEvidence(baseline), excerpt: disclosure }],
        conclusion: `Observed header value: ${disclosure}`,
      }, [baseline.id], 'Remove or genericize Server and X-Powered-By headers.'),
    );
  }

  if (cors?.outcome === 'response' && headerValue(cors, 'access-control-allow-origin') === 'https://evil.example' && headerValue(cors, 'access-control-allow-credentials') === 'true') {
    findings.push(
      misconfigFinding(scanId, endpoint, 'CORS_UNTRUSTED_ORIGIN', 'low', 'confirmed', {
        summary: 'Untrusted Origin reflected with credentials',
        requests: [{ ...requestEvidence(cors), excerpt: { allowOrigin: 'https://evil.example', allowCredentials: 'true' } }],
        conclusion: 'Header-only observation: an untrusted Origin was reflected together with Access-Control-Allow-Credentials. This is not proof of a browser-readable credentialed leak.',
      }, [cors.id], 'Reflect only approved origins and never combine a reflected Origin with credentials.'),
    );
  }

  for (const probe of errorProbes) {
    const serialized = JSON.stringify(probe.response.redactedBody ?? '');
    if (probe.outcome === 'response' && STACK_TRACE.test(serialized)) {
      findings.push(
        misconfigFinding(scanId, endpoint, 'DEBUG_INFORMATION', misconfigSeverity('DEBUG_INFORMATION'), 'confirmed', {
          summary: 'Verbose error or stack-trace information exposed',
          requests: [{ ...requestEvidence(probe), excerpt: probe.response.redactedBody }],
          conclusion: 'An error response exposed stack-trace or internal indicators.',
        }, [probe.id], 'Return generic error messages and disable stack traces outside local development.'),
      );
      break;
    }
  }

  if (options?.outcome === 'response') {
    const allow = headerValue(options, 'allow');
    if (allow) {
      findings.push(
        misconfigFinding(scanId, endpoint, 'OBSERVED_ALLOW_HEADER', 'informational', 'potential', {
          summary: 'OPTIONS/Allow advertisement observed',
          requests: [{ ...requestEvidence(options), excerpt: allow }],
          conclusion: 'An Allow advertisement is an observation, not proof that a dangerous operation is executable.',
        }, [options.id], 'Ensure advertised methods match the intended surface.'),
      );
    }
  }

  const produced = findings.some((item) => item.endpointId === endpoint.id && isMisconfigRule(item.ruleId));
  return { scanner: 'misconfiguration', outcome: produced ? 'finding' : 'no_finding', casesPlanned: planned, casesExecuted: executed };
}

function isMisconfigRule(ruleId: string): boolean {
  return ['SERVER_VERSION_DISCLOSURE', 'CORS_UNTRUSTED_ORIGIN', 'DEBUG_INFORMATION', 'OBSERVED_ALLOW_HEADER'].includes(ruleId);
}

function misconfigFinding(
  scanId: string,
  endpoint: ApiEndpoint,
  ruleId: string,
  severity: Severity,
  confidence: Confidence,
  evidence: Finding['evidence'],
  executionIds: string[],
  remediation: string,
): Finding {
  return {
    id: newId(),
    scanId,
    ruleId,
    vulnerability: 'API8:2023 Security Misconfiguration',
    severity,
    confidence,
    endpointId: endpoint.id,
    endpoint: endpoint.pathTemplate,
    method: endpoint.method.toUpperCase(),
    description: evidence.summary,
    evidence,
    executionIds,
    remediation,
    dedupKey: buildDedupKey({ ruleId, endpointId: endpoint.id }),
    createdAt: nowIso(),
    analysisMode: 'rule_based',
  };
}

function requestEvidence(result: ExecutionResult) {
  return {
    method: result.request.method,
    redactedUrl: result.request.redactedUrl,
    status: result.response.status,
    excerpt: result.response.redactedBody,
  };
}

function usableObjectResponse(result: ExecutionResult | undefined): result is ExecutionResult {
  return Boolean(
    result &&
      result.outcome === 'response' &&
      result.response.status === 200 &&
      !result.bodyTruncated &&
      result.response.redactedBody &&
      typeof result.response.redactedBody === 'object' &&
      !bodyLooksLikeLoginPage(result.response.redactedBody) &&
      !genericErrorBody(result.response.redactedBody),
  );
}

function unwrap(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  for (const wrapper of ['data', 'result', 'item', 'note', 'user', 'object']) {
    const nested = record[wrapper];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return record;
}

function ownerValue(body: unknown): unknown {
  const record = unwrap(body);
  if (!record) {
    return undefined;
  }
  for (const key of OWNER_KEYS) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
}

function idValue(body: unknown): unknown {
  const record = unwrap(body);
  if (!record) {
    return undefined;
  }
  for (const key of ID_KEYS) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
}

function requestedObjectId(result: ExecutionResult, parameter: string): string {
  const match = result.request.redactedUrl.match(/[^/]+$/);
  const selector = selectValue(result.response.redactedBody, parameter);
  return selector !== undefined ? String(selector) : (match?.[0] ?? '');
}

function exposesProtected(actual: unknown, baseline: unknown): boolean {
  const actualRecord = unwrap(actual);
  const baselineRecord = unwrap(baseline);
  if (!actualRecord || !baselineRecord) {
    return false;
  }
  return PROTECTED_KEYS.some((key) => actualRecord[key] !== undefined && baselineRecord[key] !== undefined);
}

function headerValue(result: ExecutionResult, name: string): string | undefined {
  const entry = Object.entries(result.response.redactedHeaders).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function emptyFindingSummary() {
  return {
    findingsBySeverity: Object.fromEntries(SEVERITIES.map((item) => [item, 0])) as Record<Severity, number>,
    findingsByConfidence: Object.fromEntries(CONFIDENCES.map((item) => [item, 0])) as Record<Confidence, number>,
  };
}
