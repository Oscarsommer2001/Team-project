const assert = require('node:assert/strict');
const Quiz = require('../dist/quiz.js');

const answers = [2, 3, 4, 3, 'dry', 'absurd', 'dry', ['health', 'work']];
const result = Quiz.scoreAnswers(answers);
assert.deepEqual(result, {
  tone: 'coworker',
  meanness: 3,
  humourStyle: 'dry',
  sensitiveTopics: ['health', 'work'],
  reason: 'Your answers point to level 3 pressure and a dry sense of humour.'
});
assert.deepEqual(Quiz.scoreAnswers(answers), result, 'Identical answers always produce identical results');
assert.deepEqual(Quiz.scoreAnswers([1, 1, 2, 1, 'dry', 'absurd', 'absurd', ['none']]).sensitiveTopics, []);
assert.equal(Quiz.scoreAnswers([1, 1, 1, 2, 'wholesome', 'dry', 'dramatic', ['body']]).humourStyle, 'dramatic', 'Ties go to the last humour answer');
assert.throws(() => Quiz.scoreAnswers([1, 2]), /eight questions/);
assert.throws(() => Quiz.scoreAnswers([1, 2, 3, 7, 'dry', 'dry', 'dry', ['none']]), /scores from 1 to 5/);
assert.throws(() => Quiz.scoreAnswers([1, 2, 3, 4, 'unknown', 'dry', 'dry', ['none']]), /supported humour style/);
assert.throws(() => Quiz.scoreAnswers([1, 2, 3, 4, 'dry', 'dry', 'dry', []]), /at least one sensitive topic/);
assert.equal(Quiz.styleMessage('Start with one step.', 'absurd'), 'Start with one step. A tiny committee of houseplants has been notified.');
assert.equal(Quiz.styleMessage('Start with one step.', 'unknown'), 'Start with one step.');
console.log('Quiz scoring, validation, tie-breaking, and character style checks passed.');