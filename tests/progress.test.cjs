// Rules for XP, levels, ranks, freeze-aware streaks, ranges and report cards (docs/specs/progress-gamification.md).
const assert = require('node:assert/strict');
const P = require('../dist/progress.js');
const M = require('../dist/progress-messages.js');

const row = (status, extra = {}) => ({ name: 'Read', target: 20, unit: 'pages', status, value: status === 'done' ? 20 : 0, ...extra });
// Builds logs for habit 'a' from a start date, one entry per status ('-' = no row that day).
function logsFrom(start, statuses, id = 'a') {
  const logs = {};
  statuses.forEach((s, i) => { const k = P.addDays(start, i); logs[k] = logs[k] || {}; if (s !== '-') logs[k][id] = typeof s === 'string' ? row(s) : s; });
  return logs;
}
const sim = (logs, today) => P.simulate(logs, today);
const habit = (logs, today, id = 'a') => sim(logs, today).habits[id];
const D = '2026-11-02'; // a Monday

// ---------- Accepted ----------
assert.equal(sim(logsFrom(D, ['done']), D).xp, 10, 'one completion is 10 XP');
let five = logsFrom(D, Array(5).fill('done'));
assert.equal(sim(five, P.addDays(D, 4)).xp, 55, '5 in a row = 50 + 5 bonus for reaching 3');
assert.equal(P.levelFor(55), 2);

for (const [xp, level] of [[0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [300, 4], [500, 5], [2250, 10]]) assert.equal(P.levelFor(xp), level, `${xp} XP is level ${level}`);

let partial = logsFrom(D, ['done', 'done', row('later', { value: 5 })]);
assert.equal(sim(partial, P.addDays(D, 3)).xp, 23, 'partial past day gives +3 and no penalty');
assert.equal(habit(partial, P.addDays(D, 3)).streak, 0, 'partial breaks the streak');

let twice = logsFrom(D, ['done', 'done', 'done', 'later', 'done', 'done', 'done']);
// 3 done (+30 +5), miss with no freeze at that level floor (level 1 floor 0) -> -3, then 3 done again (+30 +5)
assert.equal(sim(twice, P.addDays(D, 7)).xp, 35 - 3 + 35, 'streak bonus paid once per streak and earned again by a new streak');

let seven = logsFrom(D, [...Array(7).fill('done'), 'later']);
let s7 = sim(seven, P.addDays(D, 8));
assert.equal(s7.habits.a.streak, 7, 'a freeze keeps the streak at 7');
assert.equal(s7.habits.a.freezes, 0, 'the freeze is used up');
assert.equal(s7.habits.a.history[P.addDays(D, 7)], 'frozen', 'the missed day is marked frozen');
assert.equal(s7.days[P.addDays(D, 7)].xpLost, 0, 'a frozen day costs no XP');
assert.equal(s7.xp, 70 + 5 + 15, '7 done = 70 + bonuses at 3 and 7');

let long = logsFrom(D, Array(21).fill('done'));
assert.equal(habit(long, P.addDays(D, 20)).freezes, 2, 'freezes are capped at 2');
assert.equal(habit(long, P.addDays(D, 20)).best, 21);

for (const [rate, g] of [[100, 'A'], [90, 'A'], [89, 'B'], [75, 'B'], [74, 'C'], [60, 'C'], [59, 'D'], [40, 'D'], [39, 'F'], [0, 'F']]) assert.equal(P.grade(rate), g, `${rate}% is ${g}`);

for (const tone of Object.keys(P.RANKS)) {
  assert.equal(P.rankFor(tone, 1), P.RANKS[tone][0], `${tone} tier 1 at level 1`);
  assert.equal(P.rankFor(tone, 12), P.RANKS[tone][4], `${tone} tier 5 at level 12`);
  assert.equal(P.rankFor(tone, 30), P.RANKS[tone][5], `${tone} tier 6 at level 30`);
}
assert.deepEqual(P.nextRank('sergeant', 1), { title: 'PRIVATE', level: 3 });
assert.equal(P.nextRank('sergeant', 18), null);

const today = '2026-11-23';
const state = (logs, goals = [{ id: 'a', name: 'Read', archived: false, paused: false }]) => ({ tone: 'retriever', goals, logs });
let month = logsFrom('2026-10-01', Array(54).fill('done'));
let p7 = P.computeProgress(state(month), today, '7d');
assert.equal(p7.heat.length, 7, '7d returns 7 days');
assert.equal(p7.heat[6].key, today, 'range ends today');
assert.equal(p7.trend.length, 7, '7d trend is daily');
let mixed = { ...logsFrom('2026-09-25', Array(30).fill('later')), ...logsFrom('2026-10-25', Array(30).fill('done')) };
let p30 = P.computeProgress(state(mixed), today, '30d');
assert.equal(p30.totals.rate, 100);
assert.equal(p30.delta, 100, '30d delta compares with the previous 30 days');
assert.equal(P.computeProgress(state(mixed), today, '365d').trend[0].kind, 'week', '12 months is weekly');
assert.equal(P.computeProgress(state(mixed), today, 'all').delta, null, 'all time has no delta');

let weekLogs = logsFrom('2026-11-30', ['done', 'done', 'later', 'done', '-', '-', 'done']);
let rep = P.weekReport(state(weekLogs), '2026-12-08', 1);
assert.equal(rep.start, '2026-11-30');
assert.equal(rep.end, '2026-12-06');
assert.deepEqual([rep.overall.done, rep.overall.total, rep.overall.rate, rep.overall.grade], [4, 5, 80, 'B'], 'week across a month boundary');
assert.equal(rep.mostMissedWeekday, 3, 'Wednesday was missed');
console.log('Progress accepted-action checks passed.');

// ---------- Rejected and edge cases ----------
let noFreeze = logsFrom(D, ['done', 'later']);
let nf = sim(noFreeze, P.addDays(D, 2));
assert.equal(nf.habits.a.streak, 0, 'a miss without a freeze resets the streak');
assert.equal(nf.xp, 7, 'a miss costs 3 XP');

let floor = logsFrom(D, [...Array(5).fill('done'), 'later', 'later', 'later']);
let fl = sim(floor, P.addDays(D, 8));
assert.equal(fl.xp, 50, 'misses never drop below the level reached (55 -> floor 50)');
assert.equal(P.levelFor(fl.xp), 2);

let open = logsFrom(D, ['done', 'pending']);
let op = sim(open, P.addDays(D, 1));
assert.equal(op.xp, 10, 'today pending changes nothing');
assert.equal(op.habits.a.streak, 1, 'today pending does not break the streak');
assert.equal(op.days[P.addDays(D, 1)].missed, 0, 'today pending is not missed');

let gaps = logsFrom(D, [...Array(7).fill('done'), '-', '-', 'done']);
let gp = sim(gaps, P.addDays(D, 9));
assert.equal(gp.habits.a.streak, 8, 'unscheduled days do not break streaks');
assert.equal(gp.habits.a.freezes, 1, 'unscheduled days do not spend freezes');

let junk = logsFrom(D, ['done', { name: 'Read', status: 'skipped', value: 0 }, { name: 'Read', value: 0 }, row('later', { value: NaN }), 'done']);
junk['2027-01-01'] = { a: row('done') };
junk['not-a-date'] = { a: row('done') };
junk[P.addDays(D, 5)] = null;
let jk;
assert.doesNotThrow(() => { jk = sim(junk, P.addDays(D, 6)); }, 'bad rows never throw');
assert.equal(jk.habits.a.done, 2, 'unknown status, missing status, future and invalid dates are ignored');
assert.equal(jk.habits.a.history[P.addDays(D, 3)], 'missed', 'NaN value counts as no value');

let empty = P.computeProgress(state({}), today, '30d');
assert.equal(empty.hasData, false);
assert.equal(empty.level.level, 1);
assert.equal(empty.level.xp, 0);
assert.ok(empty.trend.every((t) => t.rate === null), 'no trend points without data');
assert.equal(P.situation(empty), 'empty');
assert.equal(P.weekReport(state({}), today, 1).overall.grade, '—', 'an empty week is "—", never F');
assert.equal(P.grade(null), '—');

assert.equal(P.rankFor('unknown-coach', 1), P.RANKS.retriever[0], 'unknown coach falls back to Retriever');
assert.equal(P.computeProgress(state(month), today, 'bogus').range, '30d', 'unknown range falls back to 30 days');

const shuffled = {};
for (const k of Object.keys(month).reverse()) shuffled[k] = month[k];
assert.deepEqual(P.computeProgress(state(shuffled), today, '30d'), P.computeProgress(state(month), today, '30d'), 'key order does not matter');
assert.equal(P.weekReport(state(month), today, -3).offset, 0, 'no future weeks');
console.log('Progress rejected-action and edge-case checks passed.');

// ---------- Coach messages ----------
for (const tone of Object.keys(P.RANKS)) {
  for (const s of ['empty', 'improving', 'declining', 'streak', 'steady']) assert.ok(M.verdict(tone, s, {}).length > 0, `${tone} has a ${s} verdict`);
  for (const g of ['A', 'B', 'C', 'D', 'F', '—']) assert.ok(M.gradeLine(tone, g).length > 0, `${tone} has a line for grade ${g}`);
  assert.ok(M.levelUpLine(tone, 3, 'X').includes('X'), `${tone} level-up line names the rank`);
}
assert.ok(!M.verdict('retriever', 'streak', { habit: 'Read', streak: 9 }).includes('{'), 'placeholders are filled');
console.log('Progress coach message checks passed.');

// ---------- Saved level marker (account data validator) ----------
const { validate } = require('../dist/account-state.js');
const saved = (extra) => ({ goals: [], logs: {}, sessions: {}, tone: 'mum', ...extra });
assert.doesNotThrow(() => validate(saved({ seenLevel: 3 })), 'a whole level number is accepted');
assert.doesNotThrow(() => validate(saved({})), 'older saves without a level are accepted');
for (const bad of [0, -1, 1.5, '2', 1001, null]) assert.throws(() => validate(saved({ seenLevel: bad })), `seenLevel ${JSON.stringify(bad)} is rejected`);
console.log('Saved level marker checks passed.');

// ---------- Sample history for guests ----------
const goalsS = [
  { id: 'read', name: 'Read', target: 20, unit: 'pages', days: [1, 3, 5], archived: false, paused: false },
  { id: 'walk', name: 'Walk', target: 1, unit: 'walk', days: [0, 1, 2, 3, 4, 5, 6], archived: false, paused: false },
  { id: 'old', name: 'Old', target: 1, unit: 'x', days: [0, 1, 2, 3, 4, 5, 6], archived: true, paused: false },
  { id: 'rest', name: 'Rest', target: 1, unit: 'x', days: [0, 1, 2, 3, 4, 5, 6], archived: false, paused: true },
];
const first = '2026-11-20';
const sampleA = P.sampleLogs(goalsS, first), sampleB = P.sampleLogs(goalsS, first);
const sampleKeys = Object.keys(sampleA).sort();
assert.deepEqual(sampleA, sampleB, 'the sample is the same on every visit');
assert.equal(sampleKeys[0], P.addDays(first, -P.SAMPLE_DAYS), 'sample covers the 8 weeks before the first real day');
assert.equal(sampleKeys[sampleKeys.length - 1], P.addDays(first, -1), 'sample stops the day before the first real day');
for (const [k, rows] of Object.entries(sampleA)) {
  assert.ok(!rows.old && !rows.rest, 'archived and paused habits get no sample');
  if (rows.read) assert.ok([1, 3, 5].includes(P.weekday(k)), 'sample follows each habit schedule');
  for (const r of Object.values(rows)) {
    assert.ok(r.sample === true && ['done', 'later'].includes(r.status) && Number.isFinite(r.value) && r.value >= 0, 'sample rows are valid and marked');
  }
}
const statuses = Object.values(sampleA).flatMap((rows) => Object.values(rows).map((r) => (r.status === 'done' ? 'done' : r.value > 0 ? 'partial' : 'missed')));
assert.ok(['done', 'partial', 'missed'].every((s) => statuses.includes(s)), 'sample has a realistic mix of done, partial and missed days');
const real = { '2026-11-20': { walk: row('done') }, '2026-11-21': { walk: row('pending') } };
const merged = P.withSample({ goals: goalsS, logs: real, tone: 'mum' }, '2026-11-21');
assert.equal(merged.first, '2026-11-20');
assert.equal(merged.state.logs['2026-11-20'], real['2026-11-20'], 'real days are never replaced by sample days');
assert.equal(Object.keys(real).length, 2, 'the saved logs are not changed');
assert.deepEqual(P.sampleLogs([], first), {}, 'no habits, no sample');
assert.deepEqual(P.sampleLogs(goalsS, 'not-a-date'), {}, 'an invalid first day gives no sample');
assert.equal(P.withSample({ goals: goalsS, logs: {}, tone: 'mum' }, '2026-11-21').first, '2026-11-21', 'a brand-new guest starts the sample before today');
assert.doesNotThrow(() => validate(saved({ hideSample: true })), 'hiding the sample is saved');
assert.throws(() => validate(saved({ hideSample: 'yes' })), 'hideSample must be true or false');
console.log('Sample history checks passed.');
