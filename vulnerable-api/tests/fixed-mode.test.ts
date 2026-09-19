import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { loginAs, registerHttpSuite } from './helpers.js';

const previous = process.env.APP_MODE;
const app = registerHttpSuite();

describe('fixed mode', () => {
  before(() => {
    process.env.APP_MODE = 'fixed';
  });

  after(() => {
    process.env.APP_MODE = previous;
  });

  it('denies cross-user note reads and unauthenticated profile access', async () => {
    const token = await loginAs('user1@test.com');
    const bola = await request(app).get('/api/notes/2').set('Authorization', `Bearer ${token}`);
    assert.equal(bola.status, 403);

    const profile = await request(app).get('/api/profile');
    assert.equal(profile.status, 401);

    const limit = await request(app).get('/api/notes?limit=100000').set('Authorization', `Bearer ${token}`);
    assert.equal(limit.status, 400);

    const debug = await request(app).get('/api/debug');
    assert.equal(debug.status, 404);

    const shared = await request(app).get('/api/notes/4').set('Authorization', `Bearer ${token}`);
    assert.equal(shared.status, 200);
  });
});
