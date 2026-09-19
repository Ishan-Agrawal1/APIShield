import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { OPERATOR, registerBackendSuite } from '../helpers.js';
import app from '../../src/app.js';

registerBackendSuite();

describe('health', () => {
  it('reports liveness without operator auth', async () => {
    const health = await request(app).get('/health').set('Host', '127.0.0.1');
    assert.equal(health.status, 200);
    const ready = await request(app).get('/ready').set('Host', '127.0.0.1');
    assert.equal(ready.status, 200);
  });
});
