const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, LIBRARY, forCategory, find } = require('../dist/habit-setup.js');
const { validate } = require('../dist/account-state.js');

// The library uses the same categories, in the same order, as the Category list in the habit form.
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const categoryList = html.match(/<select name="category">([\s\S]*?)<\/select>/)[1];
assert.deepEqual(CATEGORIES, [...categoryList.matchAll(/<option>([^<]+)<\/option>/g)].map(match => match[1]));

// Every category offers a few ideas, every habit has its own id, and none sits outside the four categories.
for (const category of CATEGORIES) assert(forCategory(category).length >= 3, `${category} offers at least three habits`);
assert(LIBRARY.every(habit => CATEGORIES.includes(habit.category)), 'Every habit belongs to one of the four categories');
assert.equal(new Set(LIBRARY.map(habit => habit.id)).size, LIBRARY.length, 'Every habit has its own id');

// Every habit fits the limits of the habit form (index.html) and the save check (app.js),
// so picking one never leads to an error message.
for (const habit of LIBRARY) {
  assert(habit.name.length >= 1 && habit.name.length <= 60, `${habit.id}: name of 1-60 characters`);
  assert(habit.detail.length >= 1 && habit.detail.length <= 100, `${habit.id}: small step of 1-100 characters`);
  assert(habit.unit.length >= 1 && habit.unit.length <= 20, `${habit.id}: unit of 1-20 characters`);
  assert(Number.isInteger(habit.target) && habit.target >= 1 && habit.target <= 100000, `${habit.id}: target is a whole number from 1 to 100000`);
  assert(habit.days.length >= 1 && habit.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6), `${habit.id}: at least one weekday`);
  assert.equal(new Set(habit.days).size, habit.days.length, `${habit.id}: no weekday twice`);
  assert.match(habit.time, /^([01]\d|2[0-3]):[0-5]\d$/, `${habit.id}: reminder time as HH:MM`);
}

// A habit saved from the library passes the check that guards account data (account-state.js).
const goals = LIBRARY.map(habit => ({ ...find(habit.id), id: 'habit-' + habit.id, createdAt: '2026-11-23', paused: false, archived: false }));
assert.doesNotThrow(() => validate({ goals, logs: {}, sessions: {}, tone: 'retriever' }), 'Library habits can be saved to an account');

// The four original ideas are still there, including "Read a little".
for (const id of ['read', 'move', 'focus', 'wind']) assert(find(id), `${id} is still in the library`);
assert.equal(find('read').name, 'Read a little');

// Accepted: a category gives only its own habits. Rejected: an unknown category gives nothing.
assert(forCategory('Fitness').every(habit => habit.category === 'Fitness'));
assert.deepEqual(forCategory('Gardening'), []);
assert.deepEqual(forCategory(undefined), []);

// Rejected: "Create my own" (the empty id) and unknown ids fill in nothing.
assert.equal(find(''), null);
assert.equal(find('does-not-exist'), null);

// Edge case: find() hands out a copy, so changing the form can't change the library.
const chosen = find('read');
chosen.name = 'Read the whole book';
chosen.days.length = 0;
assert.equal(find('read').name, 'Read a little');
assert.deepEqual(find('read').days, [0, 1, 2, 3, 4, 5, 6]);

console.log('Habit library checks passed.');
