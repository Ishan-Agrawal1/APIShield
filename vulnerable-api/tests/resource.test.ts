import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { loginAs, registerHttpSuite } from './helpers.js';
import { INTERNAL_NOTES_FETCH_CAP } from '../src/config/fixtures.js';

const app = registerHttpSuite();

describe('intentional resource-consumption acceptance', () => {
  it('accepts an excessively large notes limit instead of rejecting it', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/notes?limit=100000')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.limit, 100000);
    assert.equal(response.body.accepted, true);
    assert.equal(response.body.internalFetchCap, INTERNAL_NOTES_FETCH_CAP);
    assert.ok(response.body.count <= INTERNAL_NOTES_FETCH_CAP);
    assert.ok(Array.isArray(response.body.notes));
  });
});
