import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { persistFindings } from '../../src/services/findingService.js';
import { FindingModel } from '../../src/models/Finding.js';
import { registerBackendSuite, clearCollections } from '../helpers.js';
import type { Finding } from '@apishield/contracts';

registerBackendSuite();

describe('persistence', () => {
  it('deduplicates findings within a scan', async () => {
    await clearCollections();
    const finding: Finding = {
      id: 'f-a',
      scanId: 'scan-persist',
      ruleId: 'BOLA_READ_CROSS_USER',
      vulnerability: 'API1:2023 Broken Object Level Authorization',
      severity: 'high',
      confidence: 'confirmed',
      endpointId: 'e',
      endpoint: '/api/notes/{id}',
      method: 'GET',
      description: 'cross user',
      evidence: { summary: 'bola', conclusion: 'A read B' },
      executionIds: ['ex1'],
      remediation: 'authorize',
      dedupKey: 'BOLA_READ_CROSS_USER|e|-|2|userA->userB',
      createdAt: new Date().toISOString(),
      analysisMode: 'rule_based',
    };
    await persistFindings([finding, { ...finding, id: 'f-b', executionIds: ['ex2'] }]);
    assert.equal(await FindingModel.countDocuments({ scanId: 'scan-persist' }), 1);
    const stored = await FindingModel.findOne({ scanId: 'scan-persist' });
    assert.ok(stored);
    assert.ok((stored.executionIds ?? []).includes('ex1'));
    assert.ok((stored.executionIds ?? []).includes('ex2'));
    assert.equal(JSON.stringify(stored.toObject()).includes('password123'), false);
  });
});
