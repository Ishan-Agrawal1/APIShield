import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('intentional broken authentication on /api/profile', () => {
  it('returns 200 without an Authorization header', async () => {
    const response = await request(app).get('/api/profile');

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 1);
    assert.equal(response.body.email, 'user1@test.com');
  });

  it('returns 200 with an invalid token', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer not-a-valid-token');

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 1);
  });

  it('returns 200 with an expired token', async () => {
    const expired = jwt.sign(
      {
        userId: 1,
        email: 'user1@test.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) - 30,
      },
      process.env.JWT_SECRET || 'test-lab-secret',
    );

    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${expired}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 1);
    assert.equal(response.body.role, 'user');
  });
});
