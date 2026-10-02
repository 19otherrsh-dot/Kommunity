const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sign, verify } = require('../utils/unsubscribeToken');

test('round-trips user + community', () => {
  const token = sign('user-123', 'comm-456');
  assert.deepEqual(verify(token), { userId: 'user-123', communityId: 'comm-456' });
});

test('defaults community to "all"', () => {
  const token = sign('user-123');
  assert.deepEqual(verify(token), { userId: 'user-123', communityId: 'all' });
});

test('rejects a tampered payload', () => {
  const token = sign('user-123', 'comm-456');
  const tampered = token.replace(/^[^.]+/, Buffer.from('user-999.comm-456').toString('base64url'));
  assert.equal(verify(tampered), null);
});

test('rejects garbage / missing tokens', () => {
  assert.equal(verify(''), null);
  assert.equal(verify(undefined), null);
  assert.equal(verify('nodot'), null);
  assert.equal(verify('abc.def'), null);
});
