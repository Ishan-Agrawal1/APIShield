import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ScanBudget } from '../../src/scanner/executor/budget.js';
import { executeRequest } from '../../src/scanner/executor/httpExecutor.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';
import { defaultExecutionLimits } from '../../src/config/limits.js';
import { registerBackendSuite, startTargetApi } from '../helpers.js';

registerBackendSuite();

describe('executor', () => {
  it('constructs requests, isolates credentials, and records timeouts without fabricating status', async () => {
    const origin = await startTargetApi(15061);
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    const live = { ...profile, approvedOrigin: origin, executionLimits: { ...defaultExecutionLimits(), httpTimeoutMs: 5000 } };
    const budget = new ScanBudget({
      maxAttempts: 10,
      maxConcurrent: 2,
      maxStartsPerSecond: 2,
      maxDurationMs: 20_000,
    });
    const login = await executeRequest({
      scanId: 'scan-exec',
      testCaseId: 'login',
      endpointId: 'login',
      authContextId: null,
      template: {
        method: 'POST',
        pathTemplate: '/auth/login',
        pathValues: {},
        query: {},
        headers: { 'content-type': 'application/json' },
        body: { email: 'user1@test.com', password: 'password123' },
      },
      profile: live,
      budget,
    });
    assert.equal(login.outcome, 'response');
    assert.equal(login.response.status, 200);
    assert.equal(JSON.stringify(login.request.redactedBody).includes('password123'), false);

    const denied = await executeRequest({
      scanId: 'scan-exec',
      testCaseId: 'denied',
      endpointId: 'x',
      authContextId: null,
      template: {
        method: 'GET',
        pathTemplate: '/api/health',
        pathValues: {},
        query: {},
        headers: {},
      },
      profile: { ...live, approvedOrigin: 'http://169.254.169.254' },
      budget,
      lookupFn: async () => ['169.254.169.254'],
    });
    assert.equal(denied.outcome, 'blocked_by_policy');
    assert.equal(denied.response.status, null);
  });
});
