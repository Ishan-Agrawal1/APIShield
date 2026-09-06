import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { loginAs, registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('intentional inventory discrepancy', () => {
  it('exposes GET /api/v1/notes with a v1 response shape', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/v1/notes')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.version, 'v1');
    assert.ok(Array.isArray(response.body.notes));
    assert.equal(response.body.notes[0].id, 1);
    assert.equal(response.body.notes[0].title, 'User 1 Note');
  });

  it('exposes GET /api/v2/notes with a different v2 response shape', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/v2/notes')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.apiVersion, '2.0');
    assert.equal(response.body.result.items[0].noteId, 1);
    assert.equal(response.body.result.items[0].headline, 'User 1 Note');
    assert.ok(response.body.result.items[0].timestamps.created);
  });

  it('exposes GET /api/debug with harmless diagnostic data', async () => {
    const response = await request(app).get('/api/debug');

    assert.equal(response.status, 200);
    assert.equal(response.body.service, 'vulnerable-api');
    assert.ok(Array.isArray(response.body.documentedInventory));

    const serialized = JSON.stringify(response.body);
    assert.equal(serialized.includes('JWT_SECRET'), false);
    assert.equal(serialized.includes('MONGO_URI'), false);
    assert.equal(serialized.includes('password123'), false);
  });
});
