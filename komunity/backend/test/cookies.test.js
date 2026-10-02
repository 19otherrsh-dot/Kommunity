const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCookies } = require('../utils/cookies');

test('parses multiple cookies', () => {
  const c = parseCookies('access_token=abc123; theme=dark; foo=bar');
  assert.equal(c.access_token, 'abc123');
  assert.equal(c.theme, 'dark');
  assert.equal(c.foo, 'bar');
});

test('url-decodes values', () => {
  const c = parseCookies('name=John%20Doe');
  assert.equal(c.name, 'John Doe');
});

test('handles missing / empty header', () => {
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(''), {});
});

test('ignores malformed segments without an =', () => {
  const c = parseCookies('valid=1; broken; also=2');
  assert.equal(c.valid, '1');
  assert.equal(c.also, '2');
  assert.equal('broken' in c, false);
});
