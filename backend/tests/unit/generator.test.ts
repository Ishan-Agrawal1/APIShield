import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { assignEndpointIds, parseOpenApiDocument } from '../../src/scanner/parser/openApiParser.js';
import { generateTestCases } from '../../src/scanner/generator/testCaseGenerator.js';
import { getTargetProfile } from '../../src/config/targetProfiles.js';

describe('generator', () => {
  it('is deterministic and keeps unsafe cases ineligible', () => {
    const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vulnerable-api', 'openapi.yaml'), 'utf8');
    const parsed = parseOpenApiDocument(raw);
    const spec = {
      id: 'spec',
      sourceHash: parsed.sourceHash,
      openapiVersion: parsed.openapiVersion,
      title: parsed.title,
      createdAt: new Date().toISOString(),
      normalizedEndpoints: assignEndpointIds('spec', parsed.sourceHash, parsed.endpoints),
      warnings: parsed.warnings,
      supportSummary: parsed.supportSummary,
    };
    const profile = getTargetProfile('demo-vulnerable');
    assert.ok(profile);
    const first = generateTestCases(spec, profile);
    const second = generateTestCases(spec, profile);
    assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
    assert.ok(first.some((item) => item.variant === 'other_user'));
    assert.ok(first.some((item) => item.variant === 'missing' && !item.executionEligibility.eligible));
    assert.ok(first.some((item) => item.safetyClass === 'mutating'));
  });
});
