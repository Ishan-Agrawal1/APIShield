import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { loginAs, registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('authentication', () => {
  it('registers a new user and returns a token plus userId', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'newuser@test.com', password: 'password123' });

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.token, 'string');
    assert.equal(typeof response.body.userId, 'number');
    assert.ok(response.body.userId > 3);
  });

  it('rejects duplicate registration', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'user1@test.com', password: 'password123' });

    assert.equal(response.status, 409);
  });

  it('logs in a seeded user and returns token plus userId', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'user1@test.com', password: 'password123' });

    assert.equal(response.status, 200);
    assert.equal(response.body.userId, 1);
    assert.equal(typeof response.body.token, 'string');

    const payload = jwt.decode(response.body.token) as { userId: number };
    assert.equal(payload.userId, 1);
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'user1@test.com', password: 'wrong-password' });

    assert.equal(response.status, 401);
  });

  it('returns the authenticated identity from /auth/me', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 1,
      email: 'user1@test.com',
      role: 'user',
    });
  });

  it('rejects /auth/me without a token', async () => {
    const response = await request(app).get('/auth/me');
    assert.equal(response.status, 401);
  });

  it('rejects /auth/me with an invalid token', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-valid-token');

    assert.equal(response.status, 401);
  });
});
