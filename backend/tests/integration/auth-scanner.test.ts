import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAuthScanner } from '../../src/scanner/authentication/authScanner.js';
import { ScanBudget } from '../../src/scanner/executor/budget.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';
import { createCredentialStore } from '../../src/config/credentialStore.js';
import { defaultExecutionLimits } from '../../src/config/limits.js';

describe('authentication scanner', () => {
  it('does not flag public operations', async () => {
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    createCredentialStore('auth-test');
    const output = await runAuthScanner(
      [
        {
          id: 'public',
          specificationId: 's',
          pathTemplate: '/api/public/notices',
          method: 'get',
          parameters: [],
          responses: {},
          effectiveSecurity: [],
          securitySchemes: {},
          serverCandidates: [],
          supportStatus: 'supported',
          warnings: [],
        },
      ],
      {
        scanId: 'auth-test',
        profile: { ...profile, authenticationProbes: [], executionLimits: defaultExecutionLimits() },
        budget: new ScanBudget({ maxAttempts: 5, maxConcurrent: 1, maxStartsPerSecond: 2, maxDurationMs: 5000 }),
        fetchImpl: async () => new Response(JSON.stringify({ notices: [] }), { status: 200 }),
      },
    );
    assert.equal(output.findings.length, 0);
  });
});
