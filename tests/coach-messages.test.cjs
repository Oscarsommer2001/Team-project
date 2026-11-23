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
// Placeholders like {habit} are filled in at display time (in capitals for the Sergeant), so only the written text is checked.
const writtenText = message => message.replace(/\{\w+\}/g, '');
assert(additions.sergeant.every(message => writtenText(message) === writtenText(message).toUpperCase()), 'Sergeant messages should stay all caps');
assert(additions.sergeant.some(message => message.toLowerCase() !== message), 'Sergeant caps check still sees the written text');
console.log('Coach message bank coverage and voice checks passed.');