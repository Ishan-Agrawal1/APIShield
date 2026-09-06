import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { loginAs, registerHttpSuite } from './helpers.js';

const app = registerHttpSuite();

describe('intentional BOLA', () => {
  it('allows user 1 to read user 2\'s note by id', async () => {
    const token = await loginAs('user1@test.com');
    const response = await request(app)
      .get('/api/notes/2')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 2);
    assert.equal(response.body.userId, 2);
    assert.equal(response.body.title, 'User 2 Note');
    assert.equal(response.body.content, 'Private note belonging to User 2.');
  });

  it('allows user 1 to modify user 2\'s note and persists the change', async () => {
    const user1Token = await loginAs('user1@test.com');
    const patch = await request(app)
      .patch('/api/notes/2')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Modified by User 1' });

    assert.equal(patch.status, 200);
    assert.equal(patch.body.id, 2);
    assert.equal(patch.body.userId, 2);
    assert.equal(patch.body.title, 'Modified by User 1');

    const storedAsUser1 = await request(app)
      .get('/api/notes/2')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.equal(storedAsUser1.status, 200);
    assert.equal(storedAsUser1.body.title, 'Modified by User 1');
    assert.equal(storedAsUser1.body.userId, 2);

    const user2Token = await loginAs('user2@test.com');
    const storedAsUser2 = await request(app)
      .get('/api/notes/2')
      .set('Authorization', `Bearer ${user2Token}`);
    assert.equal(storedAsUser2.body.title, 'Modified by User 1');
    assert.equal(storedAsUser2.body.userId, 2);
  });
});
