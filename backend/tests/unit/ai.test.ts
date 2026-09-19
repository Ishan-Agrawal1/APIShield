import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attachAiAnalysis, setAiProviderForTests } from '../../src/services/ai/aiService.js';
import { minimizeForAi } from '../../src/utils/sanitize.js';
import type { Finding } from '@apishield/contracts';

function sampleFinding(overrides?: Partial<Finding>): Finding {
  return {
    id: 'f1',
    scanId: 's1',
    ruleId: 'BOLA_READ_CROSS_USER',
    vulnerability: 'API1:2023 Broken Object Level Authorization',
    severity: 'high',
    confidence: 'confirmed',
    endpointId: 'e1',
    endpoint: '/api/notes/{id}',
    method: 'GET',
    description: 'cross user',
    evidence: { summary: 'bola', conclusion: 'A read B' },
    executionIds: [],
    remediation: 'authorize',
    dedupKey: 'k',
    createdAt: new Date().toISOString(),
    analysisMode: 'rule_based',
    ...overrides,
  };
}

describe('AI analyst', () => {
  it('uses the rule-based fallback when no provider is configured', async () => {
    setAiProviderForTests(undefined);
    const [finding] = await attachAiAnalysis([sampleFinding()]);
    assert.equal(finding?.analysisMode, 'rule_based');
    assert.equal(finding?.optionalAiAnalysis?.provider, 'rule_based');
  });

  it('sends only the minimized payload to an injected provider', async () => {
    const seen: Record<string, unknown>[] = [];
    setAiProviderForTests({
      async explain(payload) {
        seen.push(payload);
        return {
          explanation: 'e',
          potentialImpact: 'p',
          remediation: 'r',
          developerSummary: 'd',
        };
      },
    });
    const finding = sampleFinding();
    const [result] = await attachAiAnalysis([finding]);
    assert.equal(result?.analysisMode, 'ai_assisted');
    assert.deepEqual(seen[0], minimizeForAi(finding as unknown as Record<string, unknown>));
    assert.equal('evidence' in (seen[0] ?? {}), false);
    setAiProviderForTests(undefined);
  });

  it('falls back when the provider throws and does not erase the finding', async () => {
    setAiProviderForTests({
      async explain() {
        throw new Error('timeout');
      },
    });
    const [result] = await attachAiAnalysis([sampleFinding()]);
    assert.equal(result?.analysisMode, 'rule_based');
    assert.equal(result?.ruleId, 'BOLA_READ_CROSS_USER');
    setAiProviderForTests(undefined);
  });
});
