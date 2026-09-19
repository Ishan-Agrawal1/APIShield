import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runMisconfigurationScanner } from '../../src/scanner/configuration/misconfigurationScanner.js';
import { ScanBudget } from '../../src/scanner/executor/budget.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';
import { defaultExecutionLimits } from '../../src/config/limits.js';

describe('misconfiguration scanner', () => {
  it('records version disclosure from headers and does not treat OPTIONS Allow as an executable exploit', async () => {
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    const output = await runMisconfigurationScanner(
      [
        {
          id: 'health',
          specificationId: 's',
          pathTemplate: '/api/health',
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
        scanId: 'misc-test',
        profile: { ...profile, approvedMethods: ['GET'], executionLimits: defaultExecutionLimits() },
        budget: new ScanBudget({ maxAttempts: 10, maxConcurrent: 1, maxStartsPerSecond: 2, maxDurationMs: 5000 }),
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.includes('/api/debug')) {
            return new Response(JSON.stringify({ stack: 'Error: lab debug\n    at getDebug' }), { status: 200 });
          }
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { Server: 'Express/5.2.1', 'Access-Control-Allow-Origin': 'https://evil.example', 'Access-Control-Allow-Credentials': 'true' },
          });
        },
      },
    );
    assert.ok(output.findings.some((item) => item.ruleId === 'SERVER_VERSION_DISCLOSURE'));
    assert.ok(output.findings.some((item) => item.ruleId === 'DEBUG_INFORMATION'));
    assert.ok(output.findings.some((item) => item.ruleId === 'CORS_UNTRUSTED_ORIGIN'));
    assert.equal(output.findings.some((item) => item.ruleId === 'OBSERVED_ALLOW_HEADER'), false);
  });
});
