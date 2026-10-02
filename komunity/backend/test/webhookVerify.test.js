const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyMuxSignature, verifyDailySignature } = require('../utils/webhookVerify');

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ type: 'video.asset.ready', data: { id: 'a' } });

test('mux: valid signature passes', () => {
  const t = '1700000000';
  const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${BODY}`).digest('hex');
  assert.equal(verifyMuxSignature(BODY, `t=${t},v1=${v1}`, SECRET), true);
});

test('mux: tampered body fails', () => {
  const t = '1700000000';
  const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${BODY}`).digest('hex');
  assert.equal(verifyMuxSignature(BODY + 'x', `t=${t},v1=${v1}`, SECRET), false);
});

test('mux: missing/garbage header fails when secret set', () => {
  assert.equal(verifyMuxSignature(BODY, '', SECRET), false);
  assert.equal(verifyMuxSignature(BODY, 'garbage', SECRET), false);
});

test('mux: no secret configured bypasses (dev)', () => {
  assert.equal(verifyMuxSignature(BODY, 'anything', undefined), true);
});

test('daily: valid base64 signature passes, tampered fails', () => {
  const sig = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64');
  assert.equal(verifyDailySignature(BODY, sig, SECRET), true);
  assert.equal(verifyDailySignature(BODY, sig, 'other'), false);
});

test('daily: no secret bypasses, missing header fails when secret set', () => {
  assert.equal(verifyDailySignature(BODY, 'x', undefined), true);
  assert.equal(verifyDailySignature(BODY, '', SECRET), false);
});
