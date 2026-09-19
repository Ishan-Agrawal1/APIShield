import type { ApiEndpoint, ExecutionResult, Finding } from '@apishield/contracts';
import { newId, nowIso } from '../../utils/ids.js';
import { executeRequest } from '../executor/httpExecutor.js';
import { securityRequiresAuth } from '../parser/versionRules.js';
import { misconfigSeverity } from '../analyzer/severity.js';
import { buildDedupKey } from '../analyzer/dedupKey.js';
import type { ScannerOutput, ScannerRunContext } from '../authorization/bolaScanner.js';

export async function runMisconfigurationScanner(
  endpoints: ApiEndpoint[],
  context: ScannerRunContext,
): Promise<ScannerOutput> {
  const findings: Finding[] = [];
  const executions: ExecutionResult[] = [];
  let planned = 0;
  let executed = 0;

  const probeEndpoint =
    endpoints.find((item) => item.pathTemplate === '/api/health' && item.method.toLowerCase() === 'get') ??
    endpoints.find((item) => item.method.toLowerCase() === 'get');

  if (probeEndpoint) {
    planned += 2;
    const baseline = await executeRequest({
      scanId: context.scanId,
      testCaseId: 'misconfig-headers',
      endpointId: probeEndpoint.id,
      authContextId: null,
      template: {
        method: 'GET',
        pathTemplate: probeEndpoint.pathTemplate,
        pathValues: {},
        query: {},
        headers: {},
      },
      profile: context.profile,
      budget: context.budget,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
    });
    executions.push(baseline);
    executed += baseline.outcome === 'response' ? 1 : 0;
    const server = header(baseline, 'server') ?? header(baseline, 'x-powered-by');
    if (baseline.outcome === 'response' && server) {
      findings.push(
        finding(context.scanId, probeEndpoint, 'SERVER_VERSION_DISCLOSURE', 'API8:2023 Security Misconfiguration', 'informational', {
          summary: 'Server or framework version disclosed',
          requests: [{ method: baseline.request.method, redactedUrl: baseline.request.redactedUrl, status: baseline.response.status, excerpt: server }],
          conclusion: `Observed header value: ${server}`,
        }, [baseline.id], 'Remove or genericize server version headers.'),
      );
    }

    const cors = await executeRequest({
      scanId: context.scanId,
      testCaseId: 'misconfig-cors',
      endpointId: probeEndpoint.id,
      authContextId: null,
      template: {
        method: 'GET',
        pathTemplate: probeEndpoint.pathTemplate,
        pathValues: {},
        query: {},
        headers: { origin: 'https://evil.example' },
      },
      profile: context.profile,
      budget: context.budget,
      extraHeaders: { origin: 'https://evil.example' },
      signal: context.signal,
      fetchImpl: context.fetchImpl,
    });
    executions.push(cors);
    executed += cors.outcome === 'response' ? 1 : 0;
    const allowOrigin = header(cors, 'access-control-allow-origin');
    const allowCreds = header(cors, 'access-control-allow-credentials');
    if (allowOrigin === 'https://evil.example' && allowCreds === 'true') {
      findings.push(
        finding(context.scanId, probeEndpoint, 'CORS_UNTRUSTED_ORIGIN', 'API8:2023 Security Misconfiguration', 'low', {
          summary: 'Untrusted Origin reflected with credentials',
          requests: [{ method: cors.request.method, redactedUrl: cors.request.redactedUrl, status: cors.response.status, excerpt: { allowOrigin, allowCreds } }],
          conclusion:
            'Header-only observation: an untrusted Origin was reflected with Access-Control-Allow-Credentials. This is not proof of a browser-readable credentialed leak.',
        }, [cors.id], 'Reflect only approved origins and avoid combining wildcard/reflected origins with credentials.'),
      );
    }
  }

  const debug = endpoints.find((item) => item.pathTemplate === '/api/debug') ?? {
    id: 'runtime-debug',
    pathTemplate: '/api/debug',
    method: 'get',
  };
  planned += 1;
  const debugResult = await executeRequest({
    scanId: context.scanId,
    testCaseId: 'misconfig-debug',
    endpointId: debug.id,
    authContextId: null,
    template: {
      method: 'GET',
      pathTemplate: '/api/debug',
      pathValues: {},
      query: {},
      headers: {},
    },
    profile: context.profile,
    budget: context.budget,
    signal: context.signal,
    fetchImpl: context.fetchImpl,
  });
  executions.push(debugResult);
  executed += debugResult.outcome === 'response' ? 1 : 0;
  const debugText = JSON.stringify(debugResult.response.redactedBody ?? '');
  if (debugResult.response.status === 200 && /stack|trace|at\s+\w+\s+\(/i.test(debugText)) {
    findings.push(
      finding(
        context.scanId,
        { id: debug.id, pathTemplate: '/api/debug', method: 'GET' },
        'DEBUG_INFORMATION',
        'API8:2023 Security Misconfiguration',
        misconfigSeverity('DEBUG_INFORMATION'),
        {
          summary: 'Debug or stack-trace information exposed',
          requests: [{ method: debugResult.request.method, redactedUrl: debugResult.request.redactedUrl, status: debugResult.response.status, excerpt: debugResult.response.redactedBody }],
          conclusion: 'The debug endpoint returned stack-trace indicators.',
        },
        [debugResult.id],
        'Disable debug endpoints and stack traces in non-development environments.',
      ),
    );
  }

  for (const endpoint of endpoints) {
    if (endpoint.supportStatus !== 'supported') {
      continue;
    }
    if (!securityRequiresAuth(endpoint.effectiveSecurity) && endpoint.pathTemplate.includes('/api/') && !isDeclaredPublic(endpoint.pathTemplate)) {
      findings.push(
        finding(context.scanId, endpoint, 'MISSING_SECURITY_DECLARATION', 'API8:2023 Security Misconfiguration', 'low', {
          summary: 'Operation has no authentication requirement in the specification',
          conclusion: 'This is a documentation warning unless a scanner also demonstrated unauthorized access.',
        }, [], 'Declare security requirements, or mark the operation as intentionally public.'),
      );
    }
  }

  if (probeEndpoint && context.profile.approvedMethods.map((item) => item.toLowerCase()).includes('options')) {
    planned += 1;
    const options = await executeRequest({
      scanId: context.scanId,
      testCaseId: 'misconfig-options',
      endpointId: probeEndpoint.id,
      authContextId: null,
      template: {
        method: 'OPTIONS',
        pathTemplate: probeEndpoint.pathTemplate,
        pathValues: {},
        query: {},
        headers: {},
      },
      profile: context.profile,
      budget: context.budget,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
    });
    executions.push(options);
    executed += options.outcome === 'response' ? 1 : 0;
    const allow = header(options, 'allow');
    if (allow) {
      findings.push(
        finding(context.scanId, probeEndpoint, 'OBSERVED_ALLOW_HEADER', 'API8:2023 Security Misconfiguration', 'informational', {
          summary: 'OPTIONS/Allow advertisement observed',
          requests: [{ method: options.request.method, redactedUrl: options.request.redactedUrl, status: options.response.status, excerpt: allow }],
          conclusion: 'An Allow advertisement is an observation, not proof that a dangerous operation is executable.',
        }, [options.id], 'Ensure advertised methods match the intended surface.'),
      );
    }
  }

  return {
    findings,
    executions,
    coverage: {
      scanner: 'misconfiguration',
      outcome: findings.length > 0 ? 'finding' : 'no_finding',
      casesPlanned: planned,
      casesExecuted: executed,
    },
  };
}

function header(result: ExecutionResult, name: string): string | undefined {
  const headers = result.response.redactedHeaders;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

function isDeclaredPublic(path: string): boolean {
  return path.startsWith('/api/health') || path.startsWith('/api/public') || path.startsWith('/auth/login') || path.startsWith('/auth/register');
}

function finding(
  scanId: string,
  endpoint: { id: string; pathTemplate: string; method: string },
  ruleId: string,
  vulnerability: string,
  severity: Finding['severity'],
  evidence: Finding['evidence'],
  executionIds: string[],
  remediation: string,
): Finding {
  return {
    id: newId(),
    scanId,
    ruleId,
    vulnerability,
    severity,
    confidence: ruleId === 'DEBUG_INFORMATION' || ruleId === 'CORS_UNTRUSTED_ORIGIN' ? 'confirmed' : 'potential',
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
