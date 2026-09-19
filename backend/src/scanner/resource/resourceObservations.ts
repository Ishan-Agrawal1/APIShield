import type { ApiEndpoint, ExecutionResult, Finding } from '@apishield/contracts';
import { executeRequest } from '../executor/httpExecutor.js';
import type { ScannerOutput, ScannerRunContext } from '../authorization/bolaScanner.js';

export async function runResourceObservations(
  endpoints: ApiEndpoint[],
  context: ScannerRunContext,
): Promise<ScannerOutput> {
  const executions: ExecutionResult[] = [];
  const findings: Finding[] = [];
  if (!context.profile.optionalCheckSettings.resourceObservations) {
    return {
      findings,
      executions,
      coverage: {
        scanner: 'resource',
        outcome: 'skipped',
        reason: 'Resource observations are disabled for this profile.',
        casesPlanned: 0,
        casesExecuted: 0,
      },
    };
  }

  const listNotes = endpoints.find((item) => item.pathTemplate === '/api/notes' && item.method.toLowerCase() === 'get');
  if (!listNotes) {
    return {
      findings,
      executions,
      coverage: {
        scanner: 'resource',
        outcome: 'skipped',
        reason: 'No suitable list endpoint was found for a bounded resource observation.',
        casesPlanned: 0,
        casesExecuted: 0,
      },
    };
  }

  const repetitions = Math.min(context.profile.executionLimits.resourceProbeRepetition, context.budget.remaining());
  const baseline = await executeRequest({
    scanId: context.scanId,
    testCaseId: 'resource-baseline',
    endpointId: listNotes.id,
    authContextId: 'demo.userA',
    template: {
      method: 'GET',
      pathTemplate: listNotes.pathTemplate,
      pathValues: {},
      query: { limit: '5' },
      headers: {},
    },
    profile: context.profile,
    budget: context.budget,
    signal: context.signal,
    fetchImpl: context.fetchImpl,
  });
  executions.push(baseline);

  for (let index = 0; index < repetitions; index += 1) {
    const result = await executeRequest({
      scanId: context.scanId,
      testCaseId: `resource-probe-${index}`,
      endpointId: listNotes.id,
      authContextId: 'demo.userA',
      template: {
        method: 'GET',
        pathTemplate: listNotes.pathTemplate,
        pathValues: {},
        query: { limit: '100000' },
        headers: {},
      },
      profile: context.profile,
      budget: context.budget,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
    });
    executions.push(result);
    if (result.response.status === 429 || result.outcome !== 'response') {
      context.budget.noteThrottle();
      break;
    }
  }

  return {
    findings,
    executions,
    coverage: {
      scanner: 'resource',
      outcome: 'no_finding',
      reason:
        'Bounded resource observations were recorded. A successful larger payload or missing 429 within five requests is not a confirmed unrestricted-resource-consumption vulnerability.',
      casesPlanned: repetitions + 1,
      casesExecuted: executions.filter((item) => item.outcome === 'response').length,
    },
  };
}
