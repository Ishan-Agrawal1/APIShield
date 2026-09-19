import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { OPERATOR, registerBackendSuite } from '../helpers.js';
import app from '../../src/app.js';
import { createScan } from '../../src/services/scanService.js';
import { ingestSpecification } from '../../src/services/specificationService.js';

registerBackendSuite();

describe('lifecycle', () => {
  it('persists a dry-run scan in a terminal completed state', async () => {
    const spec = await ingestSpecification('openapi: 3.0.3\ninfo: { title: t }\npaths:\n  /health:\n    get:\n      security: []\n      responses: { "200": { description: ok } }\n');
    const scan = await createScan({
      specificationId: spec.id,
      targetProfileId: 'demo-vulnerable',
      dryRun: true,
    });
    assert.equal(scan.status, 'completed');
    const fetched = await request(app)
      .get(`/api/scans/${scan.id}`)
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    assert.equal(fetched.body.status, 'completed');
  });
});
