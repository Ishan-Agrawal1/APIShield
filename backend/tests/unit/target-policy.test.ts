import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertTargetAllowed } from '../../src/scanner/executor/targetPolicy.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';
import { AppError } from '../../src/utils/errors.js';

describe('target policy', () => {
  it('denies destinations outside the approved profile using fake DNS', async () => {
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    await assert.rejects(
      () =>
        assertTargetAllowed('http://169.254.169.254/latest', profile, async () => ['169.254.169.254']),
      (error: unknown) => error instanceof AppError,
    );
    await assert.rejects(
      () => assertTargetAllowed('http://evil.test/api', { ...profile, approvedOrigin: 'http://127.0.0.1:5001' }, async () => ['8.8.8.8']),
      (error: unknown) => error instanceof AppError,
    );
  });
});
