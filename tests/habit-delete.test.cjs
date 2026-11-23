const assert = require('node:assert/strict');
const { deleteHabit } = require('../dist/habit-setup.js');
const { validate } = require('../dist/account-state.js');

// A small saved state: three habits (one archived, two with the same name) and three days of check-ins.
function savedState() {
  const habit = (id, name, archived = false) => ({ id, name, detail: 'A small step', category: 'Health', target: 1, unit: 'times', days: [0, 1, 2, 3, 4, 5, 6], time: '18:00', createdAt: '2026-11-01', paused: false, archived });
  const row = (name, status) => ({ name, target: 1, unit: 'times', status, value: status === 'done' ? 1 : 0 });
  return {
    goals: [habit('read', 'Read a little'), habit('run', 'Go for a run', true), habit('read-2', 'Read a little')],
    logs: {
      '2026-11-21': { read: row('Read a little', 'done'), run: row('Go for a run', 'done'), 'read-2': row('Read a little', 'later') },
      '2026-11-22': { read: row('Read a little', 'done'), 'read-2': row('Read a little', 'done') },
      '2026-11-23': { read: row('Read a little', 'pending') },
    },
    sessions: { '2026-11-22': 2 },
    tone: 'sergeant',
    fullName: 'Alex Example',
    lastSeen: '2026-11-23',
  };
}

// Accepted: the habit and every one of its check-ins are gone, and nothing else changes.
const before = savedState();
const result = deleteHabit(before, 'read');
assert.equal(result.ok, true);
assert.deepEqual(result.state.goals.map(goal => goal.id), ['run', 'read-2']);
assert.deepEqual(result.state.logs, {
  '2026-11-21': { run: before.logs['2026-11-21'].run, 'read-2': before.logs['2026-11-21']['read-2'] },
  '2026-11-22': { 'read-2': before.logs['2026-11-22']['read-2'] },
  '2026-11-23': {},
});
assert.deepEqual(result.state.sessions, before.sessions);
assert.equal(result.state.tone, 'sergeant');
assert.equal(result.state.fullName, 'Alex Example');

// Edge case: the other habit with the same name keeps its history. The id decides, not the name.
assert(result.state.goals.some(goal => goal.id === 'read-2' && goal.name === 'Read a little'));

// The old state is untouched, so nothing changes until the app saves the new one.
assert.deepEqual(before, savedState());

// The new state still passes the account check, so it can be saved to a Supabase account.
assert.doesNotThrow(() => validate(result.state));

// Accepted: an archived habit can be deleted too.
const archived = deleteHabit(savedState(), 'run');
assert.equal(archived.ok, true);
assert(!archived.state.goals.some(goal => goal.id === 'run'));
assert(!('run' in archived.state.logs['2026-11-21']));

// Edge case: deleting every habit, one after another, leaves an empty lineup and empty days.
let state = savedState();
for (const id of ['read', 'run', 'read-2']) state = deleteHabit(state, id).state;
assert.deepEqual(state.goals, []);
assert(Object.values(state.logs).every(rows => Object.keys(rows).length === 0));

// Rejected: an unknown or missing id changes nothing.
for (const id of ['does-not-exist', '', undefined]) {
  const refused = deleteHabit(before, id);
  assert.equal(refused.ok, false);
  assert.equal(refused.state, before);
}

// Rejected: a habit can't be deleted twice.
assert.equal(deleteHabit(result.state, 'read').ok, false);

console.log('Delete habit checks passed.');
