import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { assignEndpointIds, parseOpenApiDocument } from '../../src/scanner/parser/openApiParser.js';
import { countOperations, listDiscoveryView } from '../../src/scanner/discovery/normalizeEndpoints.js';

describe('discovery', () => {
  it('counts method/path operations from the lab OpenAPI document', () => {
    const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vulnerable-api', 'openapi.yaml'), 'utf8');
    const parsed = parseOpenApiDocument(raw);
    const endpoints = assignEndpointIds('spec', parsed.sourceHash, parsed.endpoints);
    assert.ok(countOperations(endpoints) >= 10);
    const view = listDiscoveryView(endpoints);
    assert.ok(view.some((item) => item.path === '/api/notes/{id}' && item.method === 'GET'));
    assert.equal(
      new Set(endpoints.map((item) => item.id)).size,
      endpoints.length,
    );
  });
});
