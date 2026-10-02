const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeCommission } = require('../utils/money');

test('40% of $99.00 = $39.60', () => {
  assert.equal(computeCommission(9900, 40), 39.6);
});

test('10% of $10.00 = $1.00', () => {
  assert.equal(computeCommission(1000, 10), 1);
});

test('zero / invalid inputs return 0', () => {
  assert.equal(computeCommission(0, 40), 0);
  assert.equal(computeCommission(9900, 0), 0);
  assert.equal(computeCommission(9900, -5), 0);
  assert.equal(computeCommission(null, 40), 0);
  assert.equal(computeCommission(9900, null), 0);
});
