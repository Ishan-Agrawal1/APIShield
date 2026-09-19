import type { ApiEndpoint, CheckOutcome, ExecutionResult, Finding, TargetProfile } from '@apishield/contracts';
import { newId, nowIso } from '../../utils/ids.js';
import { executeRequest, type ExecuteOptions } from '../executor/httpExecutor.js';
import type { ScanBudget } from '../executor/budget.js';
import { bodyLooksLikeLoginPage, genericErrorBody, selectValue } from '../analyzer/responseAnalyzer.js';
import { bolaSeverity } from '../analyzer/severity.js';
import { buildDedupKey } from '../analyzer/dedupKey.js';

export interface ScannerRunContext {
  scanId: string;
  profile: TargetProfile;
  budget: ScanBudget;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface ScannerOutput {
  findings: Finding[];
  executions: ExecutionResult[];
  coverage: { scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number };
}

export async function runBolaScanner(
  endpoints: ApiEndpoint[],
  context: ScannerRunContext,
): Promise<ScannerOutput> {
  const findings: Finding[] = [];
  const executions: ExecutionResult[] = [];
  let planned = 0;
  let executed = 0;
  let outcome: CheckOutcome = 'no_finding';
  let reason: string | undefined;

  for (const bolaCase of context.profile.bolaCases) {
    planned += 3;
    const endpoint =
      endpoints.find((item) => item.id === bolaCase.endpointId) ??
      endpoints.find(
        (item) =>
          item.pathTemplate === bolaCase.pathTemplate && item.method.toLowerCase() === bolaCase.method.toLowerCase(),
      );
    if (!endpoint) {
      reason = 'BOLA endpoint not present in the discovered specification.';
      outcome = 'skipped';
      continue;
    }

    const foreign = context.profile.accessPolicy.objects.find((object) => object.objectId === bolaCase.foreignObjectId);
    if (!foreign) {
      outcome = 'skipped';
      reason = 'Missing ownership fixture for the foreign object.';
      continue;
    }
    if (foreign.visibility !== 'private') {
      continue;
    }
    const forbidden = context.profile.accessPolicy.rules.some(
      (rule) =>
        rule.principalId === bolaCase.ownPrincipalId &&
        rule.objectId === bolaCase.foreignObjectId &&
        rule.allowed === false,
    );
    if (!forbidden) {
      continue;
    }

    const exec = (authContextId: string, objectId: string, testCaseId: string) =>
      executeRequest({
        scanId: context.scanId,
        testCaseId,
        endpointId: endpoint.id,
        authContextId,
        template: {
          method: endpoint.method,
          pathTemplate: endpoint.pathTemplate,
          pathValues: { [bolaCase.objectParameterName]: objectId },
          query: {},
          headers: {},
        },
        profile: context.profile,
        budget: context.budget,
        signal: context.signal,
        fetchImpl: context.fetchImpl,
      } satisfies ExecuteOptions);

    const baselineA = await exec(credentialRef(context, bolaCase.ownPrincipalId), bolaCase.ownObjectId, 'bola-a-own');
    const baselineB = await exec(credentialRef(context, bolaCase.foreignPrincipalId), bolaCase.foreignObjectId, 'bola-b-own');
    const cross = await exec(credentialRef(context, bolaCase.ownPrincipalId), bolaCase.foreignObjectId, 'bola-a-foreign');
    executions.push(baselineA, baselineB, cross);
    executed += [baselineA, baselineB, cross].filter((item) => item.outcome === 'response').length;

    if ([baselineA, baselineB, cross].some((item) => item.bodyTruncated)) {
      outcome = 'inconclusive';
      reason = 'Evidence was truncated.';
      continue;
    }
    if (baselineA.outcome !== 'response' || baselineB.outcome !== 'response' || cross.outcome !== 'response') {
      outcome = 'inconclusive';
      reason = 'A BOLA baseline or cross-user request did not produce an HTTP response.';
      continue;
    }
    if (baselineA.response.status !== 200 || baselineB.response.status !== 200) {
      outcome = 'inconclusive';
      reason = 'BOLA baselines were not usable.';
      continue;
    }
    if (cross.response.status === 403 || cross.response.status === 404) {
      continue;
    }
    if (bodyLooksLikeLoginPage(cross.response.redactedBody) || genericErrorBody(cross.response.redactedBody)) {
      outcome = 'inconclusive';
      reason = 'Cross-user response did not expose a protected object.';
      continue;
    }

    const foreignIdentity = bolaCase.identitySelectors.some((selector) => {
      const value = selectValue(cross.response.redactedBody, selector);
      const expected = selectValue(baselineB.response.redactedBody, selector);
      return value !== undefined && expected !== undefined && String(value) === String(expected);
    });
    const protectedLeak = bolaCase.protectedFieldSelectors.some((selector) => {
      const value = selectValue(cross.response.redactedBody, selector);
      const expected = selectValue(baselineB.response.redactedBody, selector);
      return value !== undefined && expected !== undefined && String(value) === String(expected);
    });

    if (cross.response.status === 200 && foreignIdentity && protectedLeak) {
      const confidence = 'confirmed';
      findings.push({
        id: newId(),
        scanId: context.scanId,
        ruleId: 'BOLA_READ_CROSS_USER',
        vulnerability: 'API1:2023 Broken Object Level Authorization',
        severity: bolaSeverity(confidence),
        confidence,
        endpointId: endpoint.id,
        endpoint: endpoint.pathTemplate,
        method: endpoint.method.toUpperCase(),
        parameter: bolaCase.objectParameterName,
        description: `Accessing principal ${bolaCase.ownPrincipalId} received protected object ${bolaCase.foreignObjectId} owned by ${bolaCase.foreignPrincipalId}.`,
        evidence: {
          summary: `BOLA: ${endpoint.method.toUpperCase()} ${endpoint.pathTemplate}`,
          policy: {
            accessingPrincipal: bolaCase.ownPrincipalId,
            objectOwner: bolaCase.foreignPrincipalId,
            object: bolaCase.foreignObjectId,
          },
          requests: [
            { method: baselineA.request.method, redactedUrl: baselineA.request.redactedUrl, status: baselineA.response.status },
            { method: baselineB.request.method, redactedUrl: baselineB.request.redactedUrl, status: baselineB.response.status },
            { method: cross.request.method, redactedUrl: cross.request.redactedUrl, status: cross.response.status, excerpt: cross.response.redactedBody },
          ],
          objectIdentity: { objectId: bolaCase.foreignObjectId, owner: bolaCase.foreignPrincipalId },
          conclusion:
            'A received B\'s protected object despite the configured ownership policy.',
        },
        executionIds: [baselineA.id, baselineB.id, cross.id],
        remediation: 'Enforce server-side object-level authorization before returning the object.',
        dedupKey: buildDedupKey({
          ruleId: 'BOLA_READ_CROSS_USER',
          endpointId: endpoint.id,
          parameter: bolaCase.objectParameterName,
          objectContext: bolaCase.foreignObjectId,
          authPair: `${bolaCase.ownPrincipalId}->${bolaCase.foreignPrincipalId}`,
        }),
        createdAt: nowIso(),
        analysisMode: 'rule_based',
      });
      outcome = 'finding';
    } else if (cross.response.status === 200) {
      outcome = 'inconclusive';
      reason = 'Cross-user success did not match configured identity and protected-field selectors.';
    }
  }

  return {
    findings,
    executions,
    coverage: { scanner: 'bola', outcome, reason, casesPlanned: planned, casesExecuted: executed },
  };
}

function credentialRef(context: ScannerRunContext, principalId: string): string {
  return (
    context.profile.accessPolicy.principals.find((principal) => principal.id === principalId)?.credentialReference ??
    principalId
  );
}
