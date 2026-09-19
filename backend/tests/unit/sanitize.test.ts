import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsSeededSecret, minimizeForAi, redactUrl, sanitize } from '../../src/utils/sanitize.js';

describe('sanitize', () => {
  it('redacts nested credential fields and emails without mutating the source', () => {
    const source = {
      Authorization: 'Bearer secret-token',
      nested: { password: 'password123', email: 'user1@test.com', note: 'ok' },
      list: [{ token: 'abc' }],
    };
    const copy = structuredClone(source);
    const result = sanitize(source) as typeof source;
    assert.equal(source.nested.password, copy.nested.password);
    assert.equal(result.Authorization, '[REDACTED]');
    assert.equal(result.nested.password, '[REDACTED]');
    assert.equal(result.nested.email, '[REDACTED_EMAIL]');
    assert.equal(result.nested.note, 'ok');
    assert.equal(result.list[0]?.token, '[REDACTED]');
  });

  it('redacts secrets in query strings including url-encoded values', () => {
    const redacted = redactUrl('https://example.test/callback?access_token=abc%2Fdef&ok=1');
    assert.match(redacted, /REDACTED/);
    assert.equal(redacted.includes('abc'), false);
  });

  it('omits unsafe free text from the AI payload allowlist', () => {
    const payload = minimizeForAi({
      ruleId: 'BOLA_READ_CROSS_USER',
      endpoint: '/api/notes/{id}',
      rawResponse: 'password=password123',
      description: 'cross user',
    });
    assert.ok(payload);
    assert.equal('rawResponse' in payload, false);
    assert.equal(payload.ruleId, 'BOLA_READ_CROSS_USER');
  });

  it('detects seeded secrets', () => {
    assert.equal(containsSeededSecret({ token: '[REDACTED]' }, ['password123']), false);
    assert.equal(containsSeededSecret({ leak: 'password123' }, ['password123']), true);
  });
});
