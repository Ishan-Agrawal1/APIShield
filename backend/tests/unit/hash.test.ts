import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sha256Hex, stableId } from '../../src/utils/ids.js';

describe('ids', () => {
  it('creates stable hashes', () => {
    assert.equal(sha256Hex('abc'), sha256Hex('abc'));
    assert.equal(stableId('a', 'b'), stableId('a', 'b'));
    assert.notEqual(stableId('a', 'b'), stableId('a', 'c'));
  });
});
