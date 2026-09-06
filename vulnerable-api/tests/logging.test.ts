import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { getLogEvents } from '../src/middleware/httpLogger.js';
import { loginAs, registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('structured HTTP event logging', () => {
  it('records method, uri, status, user, and bodies for a note request', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/notes/2')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);

    const event = getLogEvents().find((entry) => entry.uri === '/api/notes/2' && entry.method === 'GET');
    assert.ok(event);
    assert.equal(event.statusCode, 200);
    assert.equal(event.authenticated, true);
    assert.equal(event.userId, 1);
    assert.equal(event.objectId, 2);
    assert.equal(typeof event.timestamp, 'string');
    assert.equal((event.responseBody as { userId?: number }).userId, 2);
  });

  it('never writes passwords or bearer tokens into log events', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'user1@test.com', password: 'password123' });

    assert.equal(login.status, 200);
    const token = login.body.token as string;

    await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${token}`);

    const serialized = JSON.stringify(getLogEvents());
    assert.equal(serialized.includes('password123'), false);
    assert.equal(serialized.includes(token), false);
    assert.equal(serialized.includes(`Bearer ${token}`), false);

    const loginEvent = getLogEvents().find((entry) => entry.uri === '/auth/login');
    assert.ok(loginEvent);
    assert.equal((loginEvent.requestBody as { password?: string }).password, '[REDACTED]');
    assert.equal((loginEvent.responseBody as { token?: string }).token, '[REDACTED]');
  });
});
