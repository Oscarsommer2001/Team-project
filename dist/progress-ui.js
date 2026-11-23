/* Progress page, Today level card, streak flames, level-up pop-up and view switching.
   Loaded after app.js; uses its globals (state, $, save, dateKey, escapeHTML, toast) and themes.js (voiceStyle).
   All numbers come from GuiltProgress (progress.js). Spec: docs/specs/progress-gamification.md */
(function () {
  const P = window.GuiltProgress, M = window.GuiltProgressMessages;
  const RANGE_KEY = 'guilt-trip-progress-range', LOST_KEY = 'guilt-trip-xp-lost-shown';
  const RANGE_LABELS = { '7d': '7 days', '30d': '30 days', '365d': '12 months', all: 'All time' };
  const PERIOD = { '7d': 'the 7 days before', '30d': 'the 30 days before', '365d': 'the 12 months before' };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const OUTCOME_TEXT = { done: 'Done', missed: 'Missed', partial: 'Partly done', frozen: 'Missed · streak saved by a freeze ❄', open: 'Still open today' };
  const esc = escapeHTML;
  const say = (t) => voiceStyle(t);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  let range = P.RANGES[store.get(RANGE_KEY)] !== undefined ? store.get(RANGE_KEY) : '30d';
  let weekOffset = 1, selectedDay = null, pendingLevelUp = null, lostChecked = false, levelSynced = false;

  // Guests see made-up sample history before their first real day (never saved; hidden on request).
  const isGuest = () => window.GuiltStorage === window.localStorage;
  function view(today) {
    if (!isGuest() || state.hideSample) return { st: state, sample: null };
    const m = P.withSample(state, today);
    return m.sampleDays ? { st: m.state, sample: { first: m.first } } : { st: state, sample: null };
  }
  const isSample = (sample, key) => !!sample && key < sample.first;

  const day = (k) => P.fromKey(k);
  const fmtDay = (k) => `${DAYS[day(k).getDay()]} ${day(k).getDate()} ${MONTHS[day(k).getMonth()]}`;
  const fmtShort = (k) => `${day(k).getDate()} ${MONTHS[day(k).getMonth()]}`;
  const pct = (L) => Math.max(0, Math.min(100, Math.round(L.progress * 100)));
  const plural = (n, word) => `${n} ${n === 1 ? word : /(s|x|ch|sh)$/.test(word) ? word + 'es' : word + 's'}`;

  // ---------- Views ----------
  const currentView = () => (location.hash === '#progress' ? 'progress' : 'today');
  function applyView(scroll) {
    const view = currentView();
    document.body.dataset.view = view;
    $('#progress-page').hidden = view !== 'progress';
    const activeHref = view === 'progress' ? '#progress' : location.hash === '#focus' ? '#focus' : '#today';
    document.querySelectorAll('header nav a').forEach((a) => {
      const on = a.getAttribute('href') === activeHref;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (view === 'progress') {
      renderPage();
      if (scroll) window.scrollTo({ top: 0 });
    } else if (scroll && location.hash === '#focus') {
      $('#focus').scrollIntoView({ block: 'start' });
    }
  }
  addEventListener('hashchange', () => applyView(true));
  $('#corner-coach').addEventListener('click', () => {
    if (currentView() !== 'progress') return;
    location.hash = '#today';
    setTimeout(() => $('.coach').scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }, true);

  // ---------- Today: level card, flames, level-up, XP-lost note ----------
  function renderTodayCard(L, sample) {
    $('#today-progress').innerHTML = `<a class="tp-card" href="#progress" aria-label="Level ${L.level}, ${esc(L.rank)}. ${L.toNext} XP to level ${L.level + 1}. See your progress.${sample ? ' Includes sample history.' : ''}">
      <span class="tp-level" aria-hidden="true"><small>LEVEL</small>${L.level}</span>
      <span class="tp-main" aria-hidden="true"><strong>${esc(L.rank)}${sample ? ' <span class="tp-sample">incl. sample history</span>' : ''}</strong>
        <span class="xp-track"><span style="width:${pct(L)}%"></span></span>
        <small>${L.xp - L.floor} / ${L.next - L.floor} XP · ${L.toNext} to level ${L.level + 1}</small></span>
      <span class="tp-link" aria-hidden="true">Your progress →</span></a>`;
  }

  function decorateCards(sim) {
    document.querySelectorAll('#habit-list .habit').forEach((card) => {
      card.querySelector('.streak-chips')?.remove();
      const id = card.querySelector('[data-check]')?.dataset.check, h = id && sim.habits[id];
      if (!h || (!h.streak && !h.freezes)) return;
      const chips = document.createElement('span');
      chips.className = 'streak-chips';
      chips.innerHTML = (h.streak ? `<span class="flame" title="${h.streak}-day streak"><span aria-hidden="true">🔥</span> ${h.streak}<span class="sr-only">-day streak</span></span>` : '')
        + (h.freezes ? `<span class="freeze" title="${plural(h.freezes, 'streak freeze')} saved"><span aria-hidden="true">❄${h.freezes > 1 ? ' ' + h.freezes : ''}</span><span class="sr-only">${plural(h.freezes, 'streak freeze')} saved</span></span>` : '');
      card.querySelector('h3')?.append(chips);
    });
  }

  function checkLevel(L) {
    if (!Number.isInteger(state.seenLevel)) { state.seenLevel = L.level; save(); return; }
    if (L.level <= state.seenLevel) return;
    state.seenLevel = L.level;
    save();
    pendingLevelUp = L;
    const popup = $('#response-popup');
    if (popup.open) popup.addEventListener('close', showLevelUp, { once: true });
    else setTimeout(showLevelUp, 0);
  }
  function showLevelUp() {
    const L = pendingLevelUp, d = $('#levelup-dialog');
    if (!L || d.open) return;
    pendingLevelUp = null;
    d.querySelector('.lu-sprite').innerHTML = coachImg(state.tone, 'happy');
    $('#lu-title').textContent = `Level ${L.level}!`;
    $('#lu-rank').textContent = L.rank;
    $('#lu-line').textContent = say(M.levelUpLine(state.tone, L.level, L.rank));
    $('#lu-next').textContent = L.nextRank ? `Next rank: ${L.nextRank.title} at level ${L.nextRank.level}.` : 'Top rank reached. Legend.';
    d.showModal();
  }

  function xpLostNote(sim, today, sample) {
    if (lostChecked) return;
    lostChecked = true;
    const y = P.addDays(today, -1), d = sim.days[y];
    if (!d || !d.xpLost || isSample(sample, y) || store.get(LOST_KEY) === today) return;
    store.set(LOST_KEY, today);
    const slipped = d.missed - d.frozen;
    setTimeout(() => toast(`−${d.xpLost} XP: ${plural(slipped, 'habit')} slipped yesterday. Win it back today.`, 'upset'), 1500);
  }

  function render() {
    if (!$('#today-progress')) return;
    const today = dateKey(), v = view(today), sim = P.simulate(v.st.logs, today), L = P.levelInfo(sim.xp, state.tone);
    renderTodayCard(L, v.sample);
    decorateCards(sim);
    // Sample XP should not trigger a level-up pop-up when the page opens.
    if (v.sample && !levelSynced && Number.isInteger(state.seenLevel) && state.seenLevel < L.level) { state.seenLevel = L.level; save(); }
    levelSynced = true;
    checkLevel(L);
    xpLostNote(sim, today, v.sample);
    if (currentView() === 'progress') renderPage();
  }

  // ---------- Progress page ----------
  function moodFor(sit) { return sit === 'declining' ? 'upset' : sit === 'improving' || sit === 'streak' ? 'happy' : 'neutral'; }

  function header(L) {
    return `<div class="pp-head">
      <div class="pp-hero">
        <div class="pp-sprite">${coachImg(state.tone, 'happy')}</div>
        <div class="pp-hero-text">
          <span class="eyebrow">YOUR RANK · LEVEL ${L.level}</span>
          <h1 id="progress-title">${esc(L.rank)}</h1>
          <div class="xp-track xp-track--big" role="progressbar" aria-label="XP towards level ${L.level + 1}" aria-valuemin="0" aria-valuemax="${L.next - L.floor}" aria-valuenow="${L.xp - L.floor}"><span style="width:${pct(L)}%"></span></div>
          <p class="pp-xp-line"><strong>${L.xp} XP</strong> · ${L.toNext} XP to level ${L.level + 1}${L.nextRank ? ` · next rank “${esc(L.nextRank.title)}” at level ${L.nextRank.level}` : ''}</p>
        </div>
      </div>
      <div class="range-toggle" role="group" aria-label="Time range">${Object.entries(RANGE_LABELS).map(([k, v]) => `<button type="button" data-range="${k}" aria-pressed="${k === range}">${v}</button>`).join('')}</div>
    </div>`;
  }

  function tile(label, value, note, cls = '') {
    return `<div class="pp-tile"><span class="pp-tile-label">${label}</span><strong class="pp-tile-value">${value}</strong><span class="pp-tile-note ${cls}">${note}</span></div>`;
  }
  function tiles(p) {
    const t = p.totals;
    const deltaNote = p.delta === null
      ? (range === 'all' ? 'Since you started' : 'Nothing earlier to compare with')
      : `${p.delta > 0 ? '▲' : p.delta < 0 ? '▼' : '■'} ${Math.abs(p.delta)} points vs ${PERIOD[range]}`;
    const deltaCls = p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : '';
    const streak = p.bestStreak && p.bestStreak.streak;
    const lostNote = t.xpLost ? `−${t.xpLost} lost to ${plural(t.missed - t.frozen, 'miss')}` : t.frozen ? `❄ ${plural(t.frozen, 'freeze')} saved your streaks` : 'Nothing lost to misses';
    return `<div class="pp-tiles">
      ${tile('Completion rate', t.rate === null ? '—' : t.rate + '%', deltaNote, deltaCls)}
      ${tile('Promises kept', t.done, `of ${t.total} scheduled`)}
      ${tile('Best streak now', streak ? `<span aria-hidden="true">🔥</span> ${streak}` : '—', streak ? esc(p.bestStreak.name) : 'Complete a habit to start one')}
      ${tile('XP earned', '+' + t.xpGained, lostNote, t.xpLost ? 'down' : '')}
    </div>`;
  }

  function verdictBlock(p, sit, seed) {
    const vars = { delta: p.delta === null ? 0 : Math.abs(p.delta), rate: p.totals.rate === null ? 0 : p.totals.rate,
      habit: p.bestStreak ? p.bestStreak.name : '', streak: p.bestStreak ? p.bestStreak.streak : 0 };
    return `<div class="pp-verdict"><span class="pp-verdict-avatar">${coachImg(state.tone, moodFor(sit))}</span>
      <div><span class="eyebrow">${esc(personaNames[state.tone]).toUpperCase()} SAYS</span><blockquote>${esc(say(M.verdict(state.tone, sit, vars, seed)))}</blockquote></div></div>`;
  }

  function pointLabel(pt) {
    if (pt.kind === 'day') return fmtDay(pt.key);
    if (pt.kind === 'week') return 'Week of ' + fmtShort(pt.key);
    const [y, m] = pt.key.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
  function tickLabel(pt) {
    if (pt.kind === 'month') { const [y, m] = pt.key.split('-').map(Number); return `${MONTHS[m - 1]} ’${String(y).slice(2)}`; }
    return range === '7d' ? DAYS[day(pt.key).getDay()] : fmtShort(pt.key);
  }

  function trend(p, sample) {
    const pts = p.trend, n = pts.length;
    const wide = p.span > 42, W = wide ? 960 : 640, H = wide ? 250 : p.span <= 14 ? 250 : 360, L = 44, R = 16, T = 16, B = 36;
    const x = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
    const y = (r) => T + ((100 - r) * (H - T - B)) / 100;
    const real = pts.filter((pt) => pt.rate !== null);
    let body;
    if (!real.length) {
      body = '<p class="pp-muted">Nothing was scheduled in this range yet.</p>';
    } else {
      const segments = [];
      let seg = [];
      pts.forEach((pt, i) => { if (pt.rate === null) { if (seg.length) segments.push(seg); seg = []; } else seg.push([x(i), y(pt.rate)]); });
      if (seg.length) segments.push(seg);
      const line = segments.map((s) => 'M' + s.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L')).join('');
      const area = segments.filter((s) => s.length > 1).map((s) => `M${s[0][0].toFixed(1)},${y(0)}L` + s.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L') + `L${s[s.length - 1][0].toFixed(1)},${y(0)}Z`).join('');
      const grid = [0, 50, 100].map((r) => `<line x1="${L}" x2="${W - R}" y1="${y(r)}" y2="${y(r)}" class="pp-grid-line"/><text x="${L - 8}" y="${y(r) + 4}" text-anchor="end" class="pp-axis">${r}%</text>`).join('');
      const step = Math.max(1, Math.ceil(n / 6));
      const ticks = pts.map((pt, i) => (i % step === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= step / 2)
        ? `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="pp-axis">${tickLabel(pt)}</text>` : '').join('');
      const dots = pts.map((pt, i) => pt.rate === null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(pt.rate).toFixed(1)}" r="${n > 40 ? 3 : 4.5}" class="pp-dot" tabindex="0" aria-label="${pointLabel(pt)}: ${pt.done} of ${pt.total}, ${pt.rate}%"><title>${pointLabel(pt)} · ${pt.done} of ${pt.total} · ${pt.rate}%</title></circle>`).join('');
      const start = sample ? pts.findIndex((pt) => pt.key === (pt.kind === 'day' ? sample.first : pt.kind === 'week' ? P.mondayOf(sample.first) : sample.first.slice(0, 7))) : -1;
      const zone = start > 0 ? `<rect x="${L}" y="${T}" width="${(x(start) - L).toFixed(1)}" height="${y(0) - T}" class="pp-sample-zone"/><line x1="${x(start).toFixed(1)}" x2="${x(start).toFixed(1)}" y1="${T}" y2="${y(0)}" class="pp-start-line"/><text x="${(x(start) - 6).toFixed(1)}" y="${T + 12}" text-anchor="end" class="pp-axis pp-zone-label">${x(start) > W - 110 ? 'sample · real days start here →' : 'sample'}</text>${x(start) > W - 110 ? '' : `<text x="${(x(start) + 6).toFixed(1)}" y="${T + 12}" class="pp-axis pp-zone-label">your real days</text>`}` : '';
      body = `<svg class="pp-trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Completion rate over ${RANGE_LABELS[range].toLowerCase()}${start > 0 ? ', starting with sample data' : ''}">${zone}${grid}<path d="${area}" class="pp-area"/><path d="${line}" class="pp-line"/>${dots}${ticks}</svg>
        <table class="sr-only"><caption>Completion rate per ${pts[0].kind}</caption><tr><th>Period</th><th>Kept</th><th>Rate</th></tr>${real.map((pt) => `<tr><td>${pointLabel(pt)}</td><td>${pt.done} of ${pt.total}</td><td>${pt.rate}%</td></tr>`).join('')}</table>`;
    }
    return `<section class="panel pp-trend" aria-labelledby="pp-trend-title"><h2 id="pp-trend-title">Are you improving?</h2>
      <p class="pp-muted">Share of scheduled habits you kept, per ${pts[0] ? pts[0].kind : 'day'}.</p>${body}</section>`;
  }

  // Up to six weeks: a normal month-style calendar (Mon–Sun across). Longer: one column per week.
  function heatmap(p, sample) {
    const big = p.span <= 42;
    const lead = (p.heat[0].weekday + 6) % 7;
    const blank = '<span class="hc hc-blank" aria-hidden="true"></span>';
    const cell = (c, i) => {
      const what = c.scheduled ? `${c.done} of ${c.scheduled} done` : 'nothing scheduled';
      const fake = isSample(sample, c.key), d = day(c.key);
      const label = big ? `<span>${d.getDate()}</span>${d.getDate() === 1 || i === 0 ? `<small>${MONTHS[d.getMonth()]}</small>` : ''}` : '';
      return `<button type="button" class="hc lv-${c.level}${fake ? ' sample' : ''}${c.frozen ? ' frozen' : ''}${c.key === selectedDay ? ' sel' : ''}${c.key === p.today ? ' today' : ''}" data-day="${c.key}" aria-label="${fake ? 'Sample day, ' : ''}${fmtDay(c.key)}: ${what}${c.frozen ? ', freeze used' : ''}" aria-pressed="${c.key === selectedDay}">${label}${c.frozen ? '<i aria-hidden="true">❄</i>' : ''}</button>`;
    };
    let grid;
    if (big) {
      const heads = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="hm-head" aria-hidden="true">${d}</span>`).join('');
      grid = `<div class="hm-month${p.span <= 14 ? ' hm-few' : ''}">${heads}${blank.repeat(lead)}${p.heat.map(cell).join('')}</div>`;
    } else {
      // Columns of 7 days; a month name sits above the week where that month starts.
      const weeks = [];
      let col = Array.from({ length: lead }, () => blank), firstDate = null;
      p.heat.forEach((c, i) => {
        const date = day(c.key).getDate();
        if (firstDate === null) firstDate = { date, month: day(c.key).getMonth() };
        if (date === 1) firstDate.start = day(c.key).getMonth();
        col.push(cell(c, i));
        if (col.length === 7 || i === p.heat.length - 1) {
          const month = firstDate.start !== undefined ? firstDate.start : weeks.length === 0 && firstDate.date <= 21 ? firstDate.month : null;
          weeks.push(`<span class="hm-mon" aria-hidden="true">${month === null ? '' : MONTHS[month]}</span>${col.join('')}`);
          col = []; firstDate = null;
        }
      });
      const labels = ['', 'Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d) => `<span class="hm-lab" aria-hidden="true">${d}</span>`).join('');
      grid = `<div class="hm-scroll"><div class="hm-weeks" style="--weeks:${weeks.length}">${labels}${weeks.join('')}</div></div>`;
    }
    return `<section class="panel pp-heat" aria-labelledby="pp-heat-title"><h2 id="pp-heat-title">Your calendar</h2>
      <p class="pp-muted">Each square is a day. Tap one to see what happened.</p>
      ${grid}
      <div class="hm-legend" aria-hidden="true"><span><i class="hc lv-none"></i>Nothing scheduled</span><span><i class="hc lv-missed"></i>Missed</span><span><i class="hc lv-low"></i>Some</span><span><i class="hc lv-high"></i>Most</span><span><i class="hc lv-full"></i>All done</span><span>❄ Freeze used</span>${sample ? '<span><i class="hc lv-high sample"></i>Sample day</span>' : ''}</div>
      ${dayDetail(p, sample)}</section>`;
  }

  function dayDetail(p, sample) {
    const c = p.heat.find((h) => h.key === selectedDay);
    if (!c) return '<div class="pp-day" aria-live="polite"></div>';
    const rows = c.rows.length ? c.rows.map((r) => `<li class="o-${r.outcome}"><span>${esc(r.name)}</span><strong>${OUTCOME_TEXT[r.outcome]}${r.outcome === 'partial' ? ` (${r.value} of ${r.target} ${esc(r.unit)})` : ''}</strong></li>`).join('') : '<li><span>Nothing was scheduled.</span></li>';
    return `<div class="pp-day" aria-live="polite"><h3>${fmtDay(c.key)}${isSample(sample, c.key) ? ' <span class="sample-badge">SAMPLE</span>' : ''}</h3><ul>${rows}</ul></div>`;
  }

  function dots(list) {
    return list.map((d) => `<i class="dot d-${d.outcome || 'none'}" title="${fmtShort(d.key)}: ${d.outcome ? OUTCOME_TEXT[d.outcome] : 'not scheduled'}"></i>`).join('');
  }

  function habitList(p) {
    if (!p.habits.length) return '';
    const rows = p.habits.map((h) => `<li><button type="button" class="pp-habit" data-habit="${esc(h.id)}" aria-label="${esc(h.name)}: ${h.streak}-day streak, ${h.rate === null ? 'nothing scheduled' : h.rate + '% kept'} in ${RANGE_LABELS[range].toLowerCase()}. Open details.">
        <span class="ph-name">${esc(h.name)}${h.paused ? ' <small>paused</small>' : ''}</span>
        <span class="ph-dots" aria-hidden="true">${dots(h.last14)}</span>
        <span class="ph-streak" aria-hidden="true">${h.streak ? '🔥 ' + h.streak : '—'}${h.freezes ? ' ❄' : ''}</span>
        <span class="ph-rate" aria-hidden="true">${h.rate === null ? '—' : h.rate + '%'}</span></button></li>`).join('');
    return `<section class="panel pp-habits" aria-labelledby="pp-habits-title"><h2 id="pp-habits-title">Habit by habit</h2>
      <p class="pp-muted">Last 14 days, current streak and how often you kept it in ${RANGE_LABELS[range].toLowerCase()}. Tap a habit for details.</p><ul class="pp-habit-list">${rows}</ul></section>`;
  }

  function report(st, today, firstDay, sample) {
    const rep = P.weekReport(st, today, weekOffset);
    const earliest = firstDay ? P.mondayOf(firstDay) : P.mondayOf(today);
    const title = rep.isCurrent ? 'This week so far' : weekOffset === 1 ? 'Last week' : `${fmtShort(rep.start)} – ${fmtShort(rep.end)}`;
    const g = rep.overall.grade;
    const fakeWeek = isSample(sample, rep.end) ? '<span class="sample-badge">SAMPLE WEEK</span>' : isSample(sample, rep.start) ? '<span class="sample-badge">PARTLY SAMPLE</span>' : '';
    const table = rep.habits.length
      ? `<table class="pp-report-table"><thead><tr><th scope="col">Habit</th><th scope="col">Kept</th><th scope="col">Grade</th></tr></thead><tbody>${rep.habits.map((h) => `<tr><td>${esc(h.name)}</td><td>${h.done} of ${h.total}</td><td><span class="grade g-${h.grade === '—' ? 'none' : h.grade}">${h.grade}</span></td></tr>`).join('')}</tbody></table>`
      : '<p class="pp-muted">Nothing was scheduled this week.</p>';
    return `<section class="panel pp-report" aria-labelledby="pp-report-title">
      <div class="section-head"><h2 id="pp-report-title">Weekly report card ${fakeWeek}</h2>
        <div class="week-nav"><button type="button" class="text-btn" data-week="older" aria-label="Previous week" ${rep.start <= earliest ? 'disabled' : ''}>‹</button>
        <span>${title}${weekOffset > 1 ? '' : `<small>${fmtShort(rep.start)} – ${fmtShort(rep.end)}</small>`}</span>
        <button type="button" class="text-btn" data-week="newer" aria-label="Next week" ${rep.isCurrent ? 'disabled' : ''}>›</button></div></div>
      <div class="pp-report-top"><span class="grade grade--big g-${g === '—' ? 'none' : g}" aria-label="Overall grade ${g === '—' ? 'none' : g}">${g}</span>
        <div><strong>${rep.overall.total ? `${rep.overall.done} of ${rep.overall.total} promises kept · ${rep.overall.rate}%` : 'No promises scheduled'}</strong>
        <blockquote>${esc(say(M.gradeLine(state.tone, g)))}</blockquote>
        ${rep.mostMissedWeekday !== null ? `<small>Most slips on ${FULL_DAYS[rep.mostMissedWeekday]}s.</small>` : ''}</div></div>
      ${table}</section>`;
  }

  function sampleNote(sample) {
    return `<div class="sample-note" role="note"><span class="sample-badge">SAMPLE</span>
      <p><strong>Includes made-up sample history.</strong> Everything before ${fmtDay(sample.first)} is an example year, so you can see what your progress will look like. Your real check-ins start on ${fmtDay(sample.first)}. Sample days are never saved and don’t appear once you sign in.</p>
      <button type="button" class="sample-btn" data-sample="hide">Remove sample data</button></div>`;
  }

  function renderPage(focusSelector) {
    const page = $('#progress-page');
    if (!page || page.hidden) return;
    const today = dateKey(), v = view(today), p = P.computeProgress(v.st, today, range), sit = P.situation(p);
    const seed = Number(today.replace(/-/g, '')) + (p.delta || 0);
    const firstDay = P.firstLogDay(v.st.logs, today);
    if (selectedDay && !p.heat.some((h) => h.key === selectedDay)) selectedDay = null;
    const note = v.sample ? sampleNote(v.sample) : '';
    const showSample = isGuest() && state.hideSample ? '<button type="button" class="text-btn" data-sample="show">Bring back sample data</button>' : '';
    page.innerHTML = header(p.level) + note + (p.hasData
      ? `${tiles(p)}${verdictBlock(p, sit, seed)}<div class="pp-grid${p.span > 42 ? ' pp-wide' : ''}">${trend(p, v.sample)}${heatmap(p, v.sample)}</div>${habitList(p)}${report(v.st, today, firstDay, v.sample)}`
      : `${verdictBlock(p, sit, seed)}<div class="panel pp-empty"><p>Your history starts with one finished habit. Tick something off on Today and come back. Your calendar, trends and report cards will fill in from there.</p><a class="dark-btn" href="#today">Go to today’s habits <span>↗</span></a>${showSample ? `<p>${showSample}</p>` : ''}</div>`)
      + (p.hasData && showSample ? `<p class="pp-muted pp-sample-off">${showSample}</p>` : '');
    if (focusSelector) page.querySelector(focusSelector)?.focus();
  }

  function openHabit(id) {
    const today = dateKey(), v = view(today), p = P.computeProgress(v.st, today, range), h = p.habits.find((x) => x.id === id), d = $('#habit-detail');
    if (!h) return;
    const stat = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
    const lead = (P.weekday(h.grid[0].key) + 6) % 7;
    d.innerHTML = `<div class="section-head"><h2 id="hd-title">${esc(h.name)}</h2><button type="button" class="text-btn" data-hd-close>Close ✕</button></div>
      <div class="hd-stats">${stat('Current streak', h.streak ? '🔥 ' + h.streak : '0')}${stat('Best streak', plural(h.best, 'day'))}
      ${stat(`Kept (${RANGE_LABELS[range].toLowerCase()})`, h.rate === null ? '—' : h.rate + '%')}${stat('Total completions', h.totalDone)}
      ${stat('Freezes saved', h.freezes ? '❄ ' + h.freezes : '0')}${stat('XP from this habit', h.xp)}</div>
      <p>${h.bestWeekday !== null ? `Best day: <strong>${FULL_DAYS[h.bestWeekday]}</strong> · Toughest day: <strong>${FULL_DAYS[h.worstWeekday]}</strong>` : 'Keep going a couple of weeks to see your best and toughest days.'}</p>
      ${v.sample ? `<p class="pp-muted"><span class="sample-badge">SAMPLE</span> Days before ${fmtDay(v.sample.first)} are made-up sample history.</p>` : ''}
      <h3>Last 12 weeks</h3><div class="hd-grid">${Array.from({ length: lead }, () => '<i class="dot d-blank"></i>').join('')}${dots(h.grid)}</div>
      <div class="hm-legend"><span><i class="dot d-done"></i>Done</span><span><i class="dot d-partial"></i>Partly</span><span><i class="dot d-missed"></i>Missed</span><span><i class="dot d-frozen"></i>Freeze</span><span><i class="dot d-none"></i>Not scheduled</span></div>`;
    d.showModal();
  }

  $('#progress-page').addEventListener('click', (e) => {
    const b = e.target.closest('[data-range],[data-day],[data-habit],[data-week],[data-sample]');
    if (!b) return;
    if (b.dataset.range) { range = b.dataset.range; store.set(RANGE_KEY, range); renderPage(`[data-range="${range}"]`); }
    else if (b.dataset.day) { selectedDay = selectedDay === b.dataset.day ? null : b.dataset.day; renderPage(`[data-day="${b.dataset.day}"]`); }
    else if (b.dataset.habit) openHabit(b.dataset.habit);
    else if (b.dataset.sample) {
      state.hideSample = b.dataset.sample === 'hide';
      state.seenLevel = P.levelInfo(P.simulate(view(dateKey()).st.logs, dateKey()).xp, state.tone).level;
      save();
      selectedDay = null;
      render();
      renderPage(state.hideSample ? '[data-sample="show"]' : '[data-sample="hide"]');
    }
    else if (b.dataset.week) { weekOffset = Math.max(0, weekOffset + (b.dataset.week === 'older' ? 1 : -1)); renderPage(`[data-week="${b.dataset.week}"]:not([disabled])`); }
  });
  $('#habit-detail').addEventListener('click', (e) => { if (e.target.closest('[data-hd-close]') || e.target === e.currentTarget) e.currentTarget.close(); });

  window.GuiltProgressUI = { render, renderPage };
  render();
  applyView(false);
})();
