import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { loginAs, registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('notes and users', () => {
  it('lets user 1 retrieve their own note', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 1);
    assert.equal(response.body.userId, 1);
    assert.equal(response.body.title, 'User 1 Note');
  });

  it('lets user 1 create a note owned by user 1', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Created by User 1', content: 'Fresh note' });

    assert.equal(response.status, 201);
    assert.equal(response.body.userId, 1);
    assert.equal(response.body.title, 'Created by User 1');
    assert.ok(response.body.id > 3);
  });

  it('lets user 1 modify their own note', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .patch('/api/notes/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated User 1 Note' });

    assert.equal(response.status, 200);
    assert.equal(response.body.title, 'Updated User 1 Note');
    assert.equal(response.body.userId, 1);

    const stored = await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(stored.body.title, 'Updated User 1 Note');
  });

  it('lets user 1 delete their own note and not another user\'s note', async () => {
    const token = await loginAs('user1@test.com');

    const denied = await request(app)
      .delete('/api/notes/2')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(denied.status, 403);

    const deleted = await request(app)
      .delete('/api/notes/1')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deleted.status, 200);

    const missing = await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(missing.status, 404);
  });

  it('requires authentication for note and user routes', async () => {
    const notes = await request(app).get('/api/notes');
    const users = await request(app).get('/api/users');
    assert.equal(notes.status, 401);
    assert.equal(users.status, 401);
  });

  it('lists users without passwords and restricts cross-user profile reads', async () => {
    const token = await loginAs('user1@test.com');
    const list = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body));
    assert.equal(list.body.some((user: { password?: string }) => user.password), false);

    const other = await request(app)
      .get('/api/users/2')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(other.status, 403);

    const own = await request(app)
      .get('/api/users/1')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.email, 'user1@test.com');
  });
});
