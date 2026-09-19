import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { OPERATOR, registerBackendSuite } from '../helpers.js';
import app from '../../src/app.js';

registerBackendSuite();

describe('control API', () => {
  it('rejects unauthenticated control routes and missing resources', async () => {
    const unauth = await request(app).get('/api/targets').set('Host', '127.0.0.1');
    assert.equal(unauth.status, 401);
    const missing = await request(app)
      .get('/api/scans/not-a-scan')
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    assert.equal(missing.status, 404);
    const targets = await request(app)
      .get('/api/targets')
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    assert.equal(targets.status, 200);
    assert.ok(Array.isArray(targets.body.items));
    for (const item of targets.body.items) {
      assert.equal(JSON.stringify(item).toLowerCase().includes('password'), false);
      assert.ok(item.id);
      assert.ok(item.approvedOrigin);
    }
  });
});
