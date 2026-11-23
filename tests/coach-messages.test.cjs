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
// {habit} and {name} are placeholders that app.js fills in with capital letters for the Sergeant,
// so check each message the way the player reads it, including the replies after a check-in.
const asShown = message => message.replaceAll('{habit}', 'READ A LITTLE').replaceAll('{name}', 'ALEX');
const sergeantLines = [...additions.sergeant, ...Object.values(actionAdditions.sergeant).flat()];
assert(sergeantLines.every(message => asShown(message) === asShown(message).toUpperCase()), 'Sergeant messages should stay all caps');
console.log('Coach message bank coverage and voice checks passed.');