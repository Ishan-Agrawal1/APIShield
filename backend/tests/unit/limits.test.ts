import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../../src/config/limits.js';

describe('limits', () => {
  it('exposes the conservative MVP caps', () => {
    assert.equal(LIMITS.openApiUploadBytes, 2 * 1024 * 1024);
    assert.equal(LIMITS.httpTimeoutMs, 5000);
    assert.equal(LIMITS.maxHttpAttemptsPerScan, 100);
    assert.equal(LIMITS.resourceProbeRepetition, 5);
  });
});
