const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gradeQuiz } = require('../utils/quiz');

const quiz = {
  questions: [
    { q: 'A?', options: ['x', 'y'], answer: 0 },
    { q: 'B?', options: ['x', 'y', 'z'], answer: 2 },
    { q: 'C?', options: ['x', 'y'], answer: 1 },
  ],
};

test('all correct -> 100% and passed', () => {
  const r = gradeQuiz(quiz, [0, 2, 1]);
  assert.equal(r.score, 100);
  assert.equal(r.correct, 3);
  assert.equal(r.total, 3);
  assert.equal(r.passed, true);
});

test('two of three correct -> 67% and failed at default 70% mark', () => {
  const r = gradeQuiz(quiz, [0, 2, 0]);
  assert.equal(r.correct, 2);
  assert.equal(r.score, 67);
  assert.equal(r.passed, false);
});

test('passes at exactly the pass mark', () => {
  const r = gradeQuiz(quiz, [0, 0, 0], 33); // 1/3 = 33%
  assert.equal(r.score, 33);
  assert.equal(r.passed, true);
});

test('string answers are coerced to numbers', () => {
  const r = gradeQuiz(quiz, ['0', '2', '1']);
  assert.equal(r.passed, true);
});

test('returns null for empty quiz', () => {
  assert.equal(gradeQuiz({ questions: [] }, []), null);
  assert.equal(gradeQuiz(null, []), null);
});

test('returns null when answer count mismatches question count', () => {
  assert.equal(gradeQuiz(quiz, [0, 1]), null);
  assert.equal(gradeQuiz(quiz, 'nope'), null);
});
