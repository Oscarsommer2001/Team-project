const assert = require('node:assert/strict');
const { additions, actionAdditions } = require('../dist/coach-messages.js');

const coaches = ['retriever', 'younger', 'coworker', 'mum', 'sergeant'];
for (const coach of coaches) {
  assert.equal(additions[coach].length, 10, `${coach} should have ten new general messages`);
  for (const status of ['done', 'later', 'pending']) {
    assert.equal(actionAdditions[coach][status].length, 2, `${coach} should have two new ${status} replies`);
  }
}

assert(additions.mum.every(message => message.includes('{name}')), 'Mum messages should personalize the full name');
assert(additions.coworker.some(message => message.includes('{habit}')), 'Coach messages should personalize the habit');
assert(additions.sergeant.every(message => message === message.toUpperCase()), 'Sergeant messages should stay all caps');
console.log('Coach message bank coverage and voice checks passed.');