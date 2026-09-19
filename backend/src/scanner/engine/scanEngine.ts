import type { ApiSpecification, Finding, ScannerName, TargetProfile } from '@apishield/contracts';
import { loadEnv } from '../../config/env.js';
import { clearCredentials, createCredentialStore, setCredential } from '../../config/credentialStore.js';
import { ScanBudget } from '../executor/budget.js';
import { executeRequestRuntime } from '../executor/httpExecutor.js';
import { runBolaScanner } from '../authorization/bolaScanner.js';
import { runAuthScanner } from '../authentication/authScanner.js';
import { runMisconfigurationScanner } from '../configuration/misconfigurationScanner.js';
import { runResourceObservations } from '../resource/resourceObservations.js';
import { progressFromCounts, summarizeCoverage } from './coverage.js';
import { ScanModel } from '../../models/Scan.js';
import { persistExecutions, persistFindings } from '../../services/findingService.js';
import { attachAiAnalysis } from '../../services/ai/aiService.js';
import { SEVERITIES, CONFIDENCES, type Confidence, type Severity } from '@apishield/contracts';

function emptyFindingSummary() {
  return {
    findingsBySeverity: Object.fromEntries(SEVERITIES.map((item) => [item, 0])) as Record<Severity, number>,
    findingsByConfidence: Object.fromEntries(CONFIDENCES.map((item) => [item, 0])) as Record<Confidence, number>,
  };
}

export async function runScan(options: {
  scanId: string;
  spec: ApiSpecification;
  profile: TargetProfile;
  enabledScanners: ScannerName[];
  resourceObservations: boolean;
  runtimeCredentials?: Array<{ reference: string; token: string }>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { scanId, spec, profile, enabledScanners } = options;
  const profileWithOptions: TargetProfile = {
    ...profile,
    optionalCheckSettings: {
      ...profile.optionalCheckSettings,
      resourceObservations: options.resourceObservations,
    },
  };
  createCredentialStore(scanId);
  const budget = new ScanBudget({
    maxAttempts: profile.executionLimits.maxHttpAttempts,
    maxConcurrent: profile.executionLimits.concurrentTargetRequests,
    maxStartsPerSecond: profile.executionLimits.maxTargetRequestStartsPerSecond,
    maxDurationMs: profile.executionLimits.maxScanDurationMs,
  });

  try {
    await ScanModel.updateOne({ _id: scanId }, { $set: { status: 'running' } });
    await bootstrapCredentials(scanId, profileWithOptions, budget, options.signal, options.fetchImpl);
    applyRuntimeCredentialOverrides(scanId, options.runtimeCredentials);

    const context = {
      scanId,
      profile: profileWithOptions,
      budget,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
    };

    const outputs = [];
    if (enabledScanners.includes('bola')) {
      outputs.push(await runBolaScanner(spec.normalizedEndpoints, context));
    }
    if (enabledScanners.includes('authentication')) {
      outputs.push(await runAuthScanner(spec.normalizedEndpoints, context));
    }
    if (enabledScanners.includes('misconfiguration')) {
      outputs.push(await runMisconfigurationScanner(spec.normalizedEndpoints, context));
    }
    if (enabledScanners.includes('resource')) {
      outputs.push(await runResourceObservations(spec.normalizedEndpoints, context));
    }

    const findings: Finding[] = [];
    for (const output of outputs) {
      await persistExecutions(output.executions);
      findings.push(...output.findings);
    }
    const enriched = await attachAiAnalysis(findings);
    await persistFindings(enriched);

    const coverage = outputs.map((output) => output.coverage);
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
    const terminal = options.signal?.aborted ? 'cancelled' : summarizeCoverage(coverage).status;
    const summary = emptyFindingSummary();
    for (const finding of enriched) {
      summary.findingsBySeverity[finding.severity] += 1;
      summary.findingsByConfidence[finding.confidence] += 1;
    }

    await ScanModel.updateOne(
      { _id: scanId, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: terminal,
          completedAt: new Date().toISOString(),
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
          completedAt: new Date().toISOString(),
          errorLog: aborted
            ? []
            : [
                {
                  code: 'SCAN_FAILED',
                  message: error instanceof Error ? error.message : 'Scan failed',
                },
              ],
        },
      },
    );
  } finally {
    clearCredentials(scanId);
  }
}

async function bootstrapCredentials(
  scanId: string,
  profile: TargetProfile,
  budget: ScanBudget,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const env = loadEnv();
  const loginPath = profile.loginPath ?? '/auth/login';
  const pairs = [
    { reference: 'demo.userA', email: env.demoUserAEmail, password: env.demoUserAPassword },
    { reference: 'demo.userB', email: env.demoUserBEmail, password: env.demoUserBPassword },
  ];
  for (const pair of pairs) {
    if (!profile.credentialReferences.includes(pair.reference)) {
      continue;
    }
    const runtime = await executeRequestRuntime({
      scanId,
      testCaseId: `login-${pair.reference}`,
      endpointId: 'login',
      authContextId: null,
      template: {
        method: 'POST',
        pathTemplate: loginPath,
        pathValues: {},
        query: {},
        headers: { 'content-type': 'application/json' },
        body: { email: pair.email, password: pair.password },
      },
      profile,
      budget,
      signal,
      fetchImpl,
    });
    if (runtime.runtimeValues.token) {
      setCredential(scanId, { reference: pair.reference, authorizationHeader: `Bearer ${runtime.runtimeValues.token}` });
    }
  }

  if (profile.expiredCredentialHelperPath) {
    const expired = await executeRequestRuntime({
      scanId,
      testCaseId: 'expired-helper',
      endpointId: 'expired-helper',
      authContextId: null,
      template: {
        method: 'GET',
        pathTemplate: profile.expiredCredentialHelperPath,
        pathValues: {},
        query: {},
        headers: {},
      },
      profile,
      budget,
      signal,
      fetchImpl,
    });
    if (expired.runtimeValues.token) {
      setCredential(scanId, { reference: 'demo.expired', authorizationHeader: `Bearer ${expired.runtimeValues.token}` });
    }
  }
}

function applyRuntimeCredentialOverrides(
  scanId: string,
  overrides: Array<{ reference: string; token: string }> | undefined,
): void {
  if (!overrides?.length) {
    return;
  }
  for (const item of overrides) {
    const token = item.token.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      continue;
    }
    setCredential(scanId, { reference: item.reference, authorizationHeader: `Bearer ${token}` });
  }
}
