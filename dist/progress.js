/* Progress and gamification rules: XP, levels, coach ranks, freeze-aware streaks, ranges, trends and
   weekly report cards. Pure functions over the saved habit logs (no DOM, no storage), shared with
   tests/progress.test.cjs. Spec: docs/specs/progress-gamification.md */
(function (root) {
  const XP_DONE = 10, XP_PARTIAL = 3, XP_MISS = 3;
  const BONUSES = { 3: 5, 7: 15, 14: 30, 30: 60, 60: 100, 100: 150 };
  const MAX_FREEZES = 2, FREEZE_EVERY = 7;
  const TIER_LEVELS = [1, 3, 5, 8, 12, 18];
  const RANKS = {
    retriever: ['Good Pup', 'Fetch Pro', 'Best Buddy', 'Zoomies Champion', 'Belly-Rub Legend', 'Goodest Human Ever'],
    younger: ['page one', 'gold sticker kid', 'the one who tried', 'notebook keeper', 'who we dreamed of', 'proud of us'],
    coworker: ['Intern', 'Junior Associate', 'Associate', 'Senior Associate', 'Team Lead', 'Employee of the Month 🙂'],
    mum: ['Still Grounded', 'Allowed Dessert', 'Allowed Out Till 10', 'Fridge-Worthy', 'Better Than Your Cousin', "Mum's Favourite (Don't Tell)"],
    sergeant: ['RECRUIT', 'PRIVATE', 'CORPORAL', 'SERGEANT', 'LIEUTENANT', 'CAPTAIN'],
  };
  const RANGES = { '7d': 7, '30d': 30, '365d': 365, all: null };
  const STATUSES = ['pending', 'done', 'later'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MISSES = ['missed', 'partial', 'frozen'];

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const weekday = (k) => fromKey(k).getDay();
  const mondayOf = (k) => addDays(k, -((weekday(k) + 6) % 7));
  const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
  const rateOf = (done, total) => (total ? Math.round((done / total) * 100) : null);

  const xpForLevel = (level) => 25 * level * (level - 1);
  function levelFor(xp) { let level = 1; while (xpForLevel(level + 1) <= xp) level++; return level; }
  function tierFor(level) { let tier = 0; TIER_LEVELS.forEach((l, i) => { if (level >= l) tier = i; }); return tier; }
  const ranksOf = (tone) => RANKS[tone] || RANKS.retriever;
  function rankFor(tone, level) { return ranksOf(tone)[tierFor(level)]; }
  function nextRank(tone, level) {
    const t = tierFor(level) + 1;
    return t < TIER_LEVELS.length ? { title: ranksOf(tone)[t], level: TIER_LEVELS[t] } : null;
  }
  function grade(rate) {
    if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—';
    return rate >= 90 ? 'A' : rate >= 75 ? 'B' : rate >= 60 ? 'C' : rate >= 40 ? 'D' : 'F';
  }

  // One saved row on one day -> 'done' | 'open' (today, not done) | 'partial' | 'missed' | null (ignored).
  function outcome(row, day, today) {
    if (!row || typeof row !== 'object' || !STATUSES.includes(row.status) || day > today) return null;
    if (row.status === 'done') return 'done';
    if (day === today) return 'open';
    return Number.isFinite(row.value) && row.value > 0 ? 'partial' : 'missed';
  }

  // Replays the whole history in date order: XP (with level floor), streaks, freezes, per-day totals.
  function simulate(logs, today) {
    const habits = {}, days = {};
    let xp = 0;
    const keys = Object.keys(logs && typeof logs === 'object' ? logs : {}).filter((k) => DATE.test(k) && k <= today).sort();
    for (const day of keys) {
      const rows = logs[day] && typeof logs[day] === 'object' ? logs[day] : {};
      const info = { done: 0, total: 0, open: 0, missed: 0, frozen: 0, xpGained: 0, xpLost: 0, rows: [] };
      for (const id of Object.keys(rows).sort()) {
        const row = rows[id], result = outcome(row, day, today);
        if (!result) continue;
        const h = habits[id] || (habits[id] = { id, name: '', streak: 0, best: 0, freezes: 0, done: 0, xp: 0, history: {} });
        if (typeof row.name === 'string') h.name = row.name;
        let gain = 0, loss = 0, shown = result;
        if (result === 'done') {
          h.streak++; h.done++; info.done++; info.total++;
          gain = XP_DONE + (BONUSES[h.streak] || 0);
          if (h.streak % FREEZE_EVERY === 0) h.freezes = Math.min(MAX_FREEZES, h.freezes + 1);
          h.best = Math.max(h.best, h.streak);
        } else if (result === 'open') {
          info.open++;
        } else {
          info.total++; info.missed++;
          if (result === 'partial') gain = XP_PARTIAL;
          if (h.freezes > 0) { h.freezes--; shown = 'frozen'; info.frozen++; }
          else { h.streak = 0; if (result === 'missed') loss = XP_MISS; }
        }
        if (gain) { xp += gain; info.xpGained += gain; h.xp += gain; }
        if (loss) {
          const after = Math.max(xpForLevel(levelFor(xp)), xp - loss);
          info.xpLost += xp - after; h.xp -= xp - after; xp = after;
        }
        h.history[day] = shown;
        info.rows.push({ id, name: typeof row.name === 'string' ? row.name : '', outcome: shown,
          value: Number.isFinite(row.value) ? row.value : 0, target: Number.isFinite(row.target) ? row.target : 0,
          unit: typeof row.unit === 'string' ? row.unit : '' });
      }
      days[day] = info;
    }
    return { xp, habits, days, firstDay: keys[0] || null };
  }

  function levelInfo(xp, tone) {
    const level = levelFor(xp), floor = xpForLevel(level), next = xpForLevel(level + 1);
    return { xp, level, floor, next, toNext: next - xp, progress: (xp - floor) / (next - floor),
      rank: rankFor(tone, level), nextRank: nextRank(tone, level) };
  }

  function levelSummary(state, today) { return levelInfo(simulate(state.logs, today).xp, state.tone); }

  function totalsFor(sim, keys) {
    const t = { done: 0, total: 0, missed: 0, frozen: 0, xpGained: 0, xpLost: 0 };
    for (const k of keys) {
      const d = sim.days[k];
      if (d) for (const f of Object.keys(t)) t[f] += d[f];
    }
    t.rate = rateOf(t.done, t.total);
    return t;
  }

  function heatLevel(d, key, today) {
    if (!d) return 'none';
    const scheduled = d.total + d.open;
    if (!scheduled) return 'none';
    if (!d.done) return key === today ? 'open' : 'missed';
    if (d.done === scheduled) return 'full';
    return d.done / scheduled >= 0.5 ? 'high' : 'low';
  }

  function bucketKey(kind, k) { return kind === 'day' ? k : kind === 'week' ? mondayOf(k) : k.slice(0, 7); }

  // Everything the Progress page shows for one range ('7d' | '30d' | '365d' | 'all').
  function computeProgress(state, today, range) {
    if (!(range in RANGES)) range = '30d';
    const sim = simulate(state.logs, today);
    const len = RANGES[range];
    const start = len ? addDays(today, -(len - 1)) : (sim.firstDay || today);
    const span = Math.max(1, daysBetween(start, today) + 1);
    const keys = Array.from({ length: span }, (_, i) => addDays(start, i));
    const totals = totalsFor(sim, keys);
    let delta = null;
    if (len) {
      const prev = totalsFor(sim, Array.from({ length: len }, (_, i) => addDays(start, i - len)));
      if (prev.total && totals.rate !== null) delta = totals.rate - prev.rate;
    }
    const heat = keys.map((key) => {
      const d = sim.days[key];
      return { key, weekday: weekday(key), done: d ? d.done : 0, scheduled: d ? d.total + d.open : 0,
        frozen: d ? d.frozen : 0, level: heatLevel(d, key, today), rows: d ? d.rows : [] };
    });
    const kind = range === '7d' || range === '30d' ? 'day' : range === '365d' || span < 26 * 7 ? 'week' : 'month';
    const buckets = new Map();
    for (const key of keys) {
      const b = bucketKey(kind, key);
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(key);
    }
    const trend = [...buckets.entries()].map(([key, ks]) => {
      const t = totalsFor(sim, ks);
      return { key, kind, done: t.done, total: t.total, rate: t.rate };
    });
    const goals = (Array.isArray(state.goals) ? state.goals : []).filter((g) => g && !g.archived);
    const last = (n) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
    const habits = goals.map((g) => {
      const h = sim.habits[g.id] || { streak: 0, best: 0, freezes: 0, done: 0, xp: 0, history: {} };
      let done = 0, total = 0;
      for (const k of keys) { const o = h.history[k]; if (o === 'done') { done++; total++; } else if (MISSES.includes(o)) total++; }
      const byDay = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
      for (const [k, o] of Object.entries(h.history)) {
        if (o === 'open') continue;
        byDay[weekday(k)].total++;
        if (o === 'done') byDay[weekday(k)].done++;
      }
      const rated = byDay.map((d, i) => ({ day: i, rate: d.total >= 2 ? d.done / d.total : null })).filter((d) => d.rate !== null);
      const bestWeekday = rated.length > 1 ? rated.reduce((a, b) => (b.rate > a.rate ? b : a)).day : null;
      const worstWeekday = rated.length > 1 ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)).day : null;
      return { id: g.id, name: g.name, paused: !!g.paused, streak: h.streak, best: h.best, freezes: h.freezes,
        totalDone: h.done, xp: h.xp, done, total, rate: rateOf(done, total),
        bestWeekday: bestWeekday === worstWeekday ? null : bestWeekday,
        worstWeekday: bestWeekday === worstWeekday ? null : worstWeekday,
        last14: last(14).map((k) => ({ key: k, outcome: h.history[k] || null })),
        grid: last(84).map((k) => ({ key: k, outcome: h.history[k] || null })) };
    });
    const best = habits.filter((h) => !h.paused).reduce((a, h) => (h.streak > (a ? a.streak : 0) ? h : a), null);
    const hasData = Object.values(sim.days).some((d) => d.total > 0);
    return { range, start, today, span, totals, delta, heat, trend, habits, hasData,
      bestStreak: best ? { name: best.name, streak: best.streak } : null,
      level: levelInfo(sim.xp, state.tone) };
  }

  // Report card for one Mon–Sun week: offset 0 = this week so far, 1 = last full week, and so on.
  function weekReport(state, today, offset) {
    offset = Math.max(0, Math.floor(Number(offset) || 0));
    const sim = simulate(state.logs, today);
    const start = addDays(mondayOf(today), -7 * offset), end = addDays(start, 6);
    const per = {}, missesByDay = Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i), d = sim.days[k];
      if (!d || k > today) continue;
      for (const r of d.rows) {
        if (r.outcome === 'open') continue;
        const p = per[r.id] || (per[r.id] = { id: r.id, name: r.name, done: 0, total: 0 });
        p.name = r.name || p.name; p.total++;
        if (r.outcome === 'done') p.done++; else missesByDay[weekday(k)]++;
      }
    }
    const habits = Object.values(per).sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ ...p, rate: rateOf(p.done, p.total), grade: grade(rateOf(p.done, p.total)) }));
    const done = habits.reduce((n, h) => n + h.done, 0), total = habits.reduce((n, h) => n + h.total, 0);
    const worst = Math.max(...missesByDay);
    return { start, end, offset, isCurrent: offset === 0, habits,
      overall: { done, total, rate: rateOf(done, total), grade: grade(rateOf(done, total)) },
      mostMissedWeekday: worst > 0 ? missesByDay.indexOf(worst) : null };
  }

  // ---------- Sample history (guests only, never saved) ----------
  // Stable pseudo-random number in [0, 1) for a string, so the sample looks the same on every visit.
  function unit(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  // A full year, so every range on the Progress page (7d, 30d, 12m, All) is filled.
  const SAMPLE_DAYS = 365;
  // Made-up history for the active habits on the `days` days before `firstRealDay`, following each
  // habit's schedule and slowly improving. Rows are marked `sample: true`.
  function sampleLogs(goals, firstRealDay, days = SAMPLE_DAYS) {
    const logs = {};
    const active = (Array.isArray(goals) ? goals : []).filter((g) => g && typeof g.id === 'string' && !g.archived && !g.paused);
    if (!active.length || !DATE.test(String(firstRealDay))) return logs;
    for (let i = days; i >= 1; i--) {
      const key = addDays(firstRealDay, -i), wd = weekday(key), rows = {};
      active.forEach((g, gi) => {
        if (Array.isArray(g.days) && !g.days.includes(wd)) return;
        const target = Number.isFinite(g.target) && g.target > 0 ? g.target : 1;
        const chance = 0.42 + (1 - i / days) * 0.38 - (gi % 3) * 0.06 - (wd === 0 || wd === 6 ? 0.1 : 0);
        const r = unit(g.id + '|' + key);
        const done = r < chance, partial = !done && r < chance + 0.12;
        rows[g.id] = { name: typeof g.name === 'string' ? g.name : 'Habit', target, unit: typeof g.unit === 'string' ? g.unit : '',
          status: done ? 'done' : 'later', value: done ? target : partial ? Math.max(1, Math.round(target / 2)) : 0, sample: true };
      });
      if (Object.keys(rows).length) logs[key] = rows;
    }
    return logs;
  }
  const firstLogDay = (logs, today) => Object.keys(logs && typeof logs === 'object' ? logs : {}).filter((k) => DATE.test(k)).sort()[0] || today;
  // The state with sample days added before the first real day. Real days always win.
  function withSample(state, today) {
    const first = firstLogDay(state.logs, today), sample = sampleLogs(state.goals, first);
    return { first, sampleDays: Object.keys(sample).length, state: { ...state, logs: { ...sample, ...state.logs } } };
  }

  // Picks which kind of coach verdict fits the numbers.
  function situation(p) {
    if (!p.hasData) return 'empty';
    if (p.delta !== null && p.delta >= 10) return 'improving';
    if (p.delta !== null && p.delta <= -10) return 'declining';
    if (p.bestStreak && p.bestStreak.streak >= 7) return 'streak';
    return 'steady';
  }

  const api = { XP_DONE, XP_PARTIAL, XP_MISS, BONUSES, MAX_FREEZES, TIER_LEVELS, RANKS, RANGES,
    keyOf, fromKey, addDays, mondayOf, weekday, xpForLevel, levelFor, rankFor, nextRank, grade, outcome,
    simulate, levelInfo, levelSummary, computeProgress, weekReport, situation, SAMPLE_DAYS, sampleLogs, withSample, firstLogDay };
  root.GuiltProgress = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
