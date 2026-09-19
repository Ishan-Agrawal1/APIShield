import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runResourceObservations } from '../../src/scanner/resource/resourceObservations.js';
import { ScanBudget } from '../../src/scanner/executor/budget.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';
import { defaultExecutionLimits } from '../../src/config/limits.js';

describe('resource observations', () => {
  it('sends no probes when disabled', async () => {
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    let calls = 0;
    const output = await runResourceObservations([], {
      scanId: 'res-test',
      profile: {
        ...profile,
        optionalCheckSettings: { resourceObservations: false, corsBrowserConfirmation: false },
        executionLimits: defaultExecutionLimits(),
      },
      budget: new ScanBudget({ maxAttempts: 10, maxConcurrent: 1, maxStartsPerSecond: 2, maxDurationMs: 5000 }),
      fetchImpl: async () => {
        calls += 1;
        return new Response('{}', { status: 200 });
      },
    });
    assert.equal(output.coverage.outcome, 'skipped');
    assert.equal(calls, 0);
    assert.equal(output.findings.length, 0);
  });
});
