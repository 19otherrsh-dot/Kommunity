const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { hashKey } = require('../controllers/apiKeyController');

test('hashKey is deterministic sha256 hex', () => {
  const key = 'kmn_live_abc123';
  const expected = crypto.createHash('sha256').update(key).digest('hex');
  assert.equal(hashKey(key), expected);
  assert.equal(hashKey(key), hashKey(key));
});

test('different keys produce different hashes', () => {
  assert.notEqual(hashKey('kmn_live_a'), hashKey('kmn_live_b'));
});
