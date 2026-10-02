const PASS_MARK = 70; // % required to pass a quiz

/**
 * Grade a quiz submission (pure, no I/O).
 * @param {{questions: Array<{answer:number}>}} quiz
 * @param {Array<number>} answers - selected option indices, parallel to questions
 * @param {number} passMark
 * @returns {{correct:number,total:number,score:number,passed:boolean,pass_mark:number}|null}
 *          null when the quiz is empty/invalid.
 */
function gradeQuiz(quiz, answers, passMark = PASS_MARK) {
  const questions = (quiz && Array.isArray(quiz.questions)) ? quiz.questions : [];
  if (questions.length === 0) return null;
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;

  const correct = questions.reduce(
    (acc, q, i) => acc + (Number(q.answer) === Number(answers[i]) ? 1 : 0),
    0
  );
  const score = Math.round((correct / questions.length) * 100);
  return { correct, total: questions.length, score, passed: score >= passMark, pass_mark: passMark };
}

module.exports = { gradeQuiz, PASS_MARK };
