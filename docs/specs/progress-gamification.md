# Spec: Progress, gamification and history

**Status:** ready to build · **Branch:** `feature/progress-gamification` · **Written:** 23 Nov 2026
**Hard deadline:** merged to `main` before **23:59 tonight** (commits after it are not graded).
Decisions below come from the product owner's answers to 10 questions; treat them as fixed.

## Why

Progress is one small panel on the Today page today: a 7-day bar chart, three numbers, a per-habit count, a 28-day heat map and a lifetime milestone line. It doesn't answer "am I improving?", has no history beyond 28 days and gives no reason to come back tomorrow. This feature adds a real Progress page with clear overviews and a light game layer: XP, levels, coach ranks, streak flames and streak freezes. It should feel fun and be very easy to read. It supports grading criteria 2 (UI/UX), 3 (scope) and 4 (verification).

## What (decisions)

| # | Decision |
| --- | --- |
| 1 | Ship tonight, before 23:59. Scope is cut to what fits (see *Priorities*). |
| 2 | **Own Progress page** opened from the top nav; Today keeps a small summary card. |
| 3 | Mechanics: **XP and levels**, **coach-themed ranks**, **streak flames + freezes**. No badges. |
| 4 | Misses cost a **small amount of XP**, but you **never drop a level**. |
| 5 | Overviews: **heat-map calendar**, **trend chart**, **per-habit detail**, **weekly report card**. |
| 6 | One range toggle: **7 days / 30 days / 12 months / All time**, which changes every number and chart together. |
| 7 | The coach gives **short in-character verdicts** on the stats. |
| 8 | No sharing or export tonight. |
| 9 | Everything is **calculated from the saved habit logs**: no new database tables. It works the same for guests and accounts. |
| 10 | Visuals **follow each coach's theme** (CSS variables already set per theme). |

## Rules (the source of truth for the tests)

All rules run over `state.logs` (`{ 'YYYY-MM-DD': { habitId: {name, target, unit, status, value} } }`) up to and including today's local date, in date order. Existing rules still hold: today's unfinished habits are never "missed", unscheduled days (no row) never break a streak, and past rows keep their snapshot.

**Row outcome per day:**
- `done`: status `done`.
- `partial`: a past day, not done, `value > 0`.
- `missed`: a past day, not done (includes partial for streak purposes).
- `open`: today and not done (neutral: no XP change, doesn't break or extend a streak).
- Rows with an unknown or missing status, or dates after today, are **ignored** (no crash).

**XP:**
- `done`: **+10**.
- `partial` on a past day: **+3** (on top of it counting as a miss for streaks, but no −3 penalty).
- Streak milestone bonus, once per streak, when a habit's streak *reaches* 3 / 7 / 14 / 30 / 60 / 100: **+5 / +15 / +30 / +60 / +100 / +150**.
- `missed` with no value and no freeze available: **−3**.
- **Level floor:** a penalty can never take XP below the floor of the level already reached, so XP goes down but the level never does.

**Levels:** reaching level *L* needs `25 × L × (L − 1)` XP in total. So level 1 starts at 0, level 2 at 50, level 3 at 150, level 4 at 300, level 5 at 500, level 10 at 2,250. Show XP inside the level ("120 / 150 XP · 30 to level 3").

**Streak freezes ("excuse tokens"):** one bank per habit.
- Earn **1** each time that habit's streak reaches a multiple of 7. Hold at most **2**.
- A missed scheduled day automatically spends 1 if available. The streak is **kept** (not increased), there's **no XP penalty**, and the day is marked `frozen` (shown with ❄).
- With none banked, a miss resets the streak to 0.
- `bestStreak` is the longest streak ever reached.
- `HabitCore.streak` stays unchanged (its tests must still pass). The new page and the habit cards use the freeze-aware streak.

**Coach ranks:** the tier comes from the level. Levels 1 / 3 / 5 / 8 / 12 / 18 map to tiers 1–6:

| Coach | Tier 1 → 6 |
| --- | --- |
| Retriever | Good Pup · Fetch Pro · Best Buddy · Zoomies Champion · Belly-Rub Legend · Goodest Human Ever |
| Younger You | page one · gold sticker kid · the one who tried · notebook keeper · who we dreamed of · proud of us |
| Coworker | Intern · Junior Associate · Associate · Senior Associate · Team Lead · Employee of the Month 🙂 |
| Mum | Still Grounded · Allowed Dessert · Allowed Out Till 10 · Fridge-Worthy · Better Than Your Cousin · Mum's Favourite (Don't Tell) |
| Sergeant | RECRUIT · PRIVATE · CORPORAL · SERGEANT · LIEUTENANT · CAPTAIN |

Switching coach changes the rank title, not the level. The Sergeant's old win-count rank in `themes.js` is replaced by this one.

**Report-card grades** (completion rate of scheduled rows): A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40 · F < 40 · no scheduled rows → "—" (never F).

**Ranges:** `7d`, `30d` and `365d` are the last N days including today; `all` runs from the first log date to today. The comparison delta is against the previous period of the same length (left out for `all`, or when the previous period has no scheduled rows).

**Trend buckets:** `7d` and `30d` → daily; `365d` → weekly (Mon–Sun); `all` → weekly if under 26 weeks, else monthly. Each point is the completion rate (done ÷ scheduled, today counted only if done). Buckets with nothing scheduled are gaps, not zeros.

## Screens

**Navigation.** The nav links become views: `#today` (default), `#focus` (scrolls to the focus room on Today) and `#progress` (shows the Progress page, hides the Today content). Use `hashchange`, keep back/forward working, and set `aria-current="page"` on the active link. The old progress panel at the bottom of Today is removed.

**Today summary card** (above the habit list). Coach rank title, level, an XP bar with "N XP to level L+1", and a "See your progress →" link. Each habit card shows its streak (🔥 7) and ❄ when a freeze is banked. Show nothing for a streak of 0.

**Progress page**, top to bottom:
1. **Header:** rank and level with the XP bar, plus the range toggle (a segmented control with 4 buttons that works with the keyboard).
2. **Stat tiles (4):** completion rate (with ▲/▼ delta), habits completed, best current streak (habit name + 🔥), XP earned in range (+gained / −lost).
3. **Coach verdict:** one or two lines in the coach's voice, chosen by situation: improving / declining / steady / great streak / no data yet. Pass the text through the existing `voiceStyle`.
4. **Trend chart:** hand-built inline SVG (no chart library, to keep dependencies minimal). A line and soft area for the rate, with dots, a 0–100 % axis and labelled x-axis ticks. Hover or focus a point to show "Week of 16 Nov · 4 of 6 · 67 %". It includes a visually hidden data table for screen readers.
5. **Heat-map calendar:** a GitHub-style grid with weeks as columns and Mon–Sun as rows. Cells are bigger for 7d and 30d. Levels: nothing scheduled · missed · 1–49 % · 50–99 % · 100 %, plus a ❄ marker on frozen days, with a legend. Each cell is focusable; clicking it or pressing Enter opens a **day detail** listing every habit that day and its status.
6. **Per-habit list:** name, 🔥 current streak, rate in range, and a 14-day dot strip. Clicking a row opens the **habit detail dialog**: current and best streak, rate, total completions, freezes banked, best and worst weekday, XP earned from this habit, and a 12-week mini heat map.
7. **Weekly report card:** last full Mon–Sun week by default, with ‹ › arrows to move between weeks (no future weeks). It shows an overall grade, a grade per habit, the most-missed weekday and a coach verdict for the grade.
8. **Empty state** (no logs yet): a friendly coach line and an "Add your first habit" button. No empty charts.

**Level-up moment.** After an action raises the level above `state.seenLevel`, show the existing coach pop-up with the happy sprite, "Level 4!" and the new rank title (with confetti for the Retriever, respecting reduced motion). On first load, `seenLevel` is set silently so existing users don't get a burst of pop-ups. `seenLevel` lives in `state`, so it saves for guests and accounts the same way as everything else.

**Usability rules:** every number has a plain label; every chart has a text alternative; WCAG AA contrast in all five themes; works from 360 px phone width; no layout shift when the range changes; the page renders in under 100 ms for 1 year of logs with 10 habits.

## Files

| File | Purpose |
| --- | --- |
| `dist/progress.js` | **Pure** calculations, no DOM: `computeProgress(state, todayKey, range)`, `levelFor(xp)`, `rankFor(tone, level)`, `grade(rate)`, `weekReport(state, weekStartKey)`. Exported via `module.exports` for tests, like `core.js`. |
| `dist/progress-messages.js` | Rank titles and verdict lines per coach and situation (2 per situation). |
| `dist/progress-ui.js` | Renders the Today card, Progress page, dialogs and level-up; handles the view switching. |
| `dist/progress.css` | Layout using the existing theme variables (`--accent`, `--surface`, `--ink`, `--line`, `--radius`). |
| `dist/index.html` | Nav, page section, dialogs, script and style tags (with a `?v=` cache-buster like the others). |
| `dist/app.js` / `dist/themes.js` | Call the progress renderer from `render()`; remove the old progress panel code and the Sergeant win-count rank. |
| `tests/progress.test.cjs` | Rule tests (below). |
| `README.md` | "Implemented" list, the new test command. |

## Tests (`tests/progress.test.cjs`, Node, no dependencies, fixed dates)

**Accepted:**
- 1 done → 10 XP; 5 done in a row → 50 + 5 (3-day bonus) = 55 XP, level 2.
- Level thresholds: 0→1, 49→1, 50→2, 149→2, 150→3, 2,250→10.
- Partial past day → +3, streak broken, no −3.
- Streak bonuses at 3 and 7 are paid once; a new streak can earn them again.
- 7 done in a row → 1 freeze; the next missed day keeps the streak at 7, costs no XP and is marked frozen.
- Freezes are capped at 2 after 21 straight completions.
- Grades at the boundaries: 90 A, 89 B, 75 B, 74 C, 60 C, 40 D, 39 F.
- Rank: every coach gives tier 1 at level 1, tier 5 at level 12 and tier 6 at level 30.
- Ranges: `7d` returns 7 days ending today; `30d` delta compared with the previous 30 days.
- Week report across a month boundary (Mon 30 Nov – Sun 6 Dec) groups the right days.

**Rejected / edge cases:**
- A miss with no freeze → −3 and the streak resets to 0.
- Misses never drop the level: at level 2 with 50 XP, three misses leave 50 XP.
- Today's pending row → no XP change, no streak break, not "missed".
- Unscheduled days (no row) don't break streaks or spend freezes.
- Future-dated rows, rows with unknown or missing status, and `value: NaN` are ignored without throwing.
- No logs → empty-state result (level 1, 0 XP, no trend points, grade "—").
- A week with nothing scheduled → grade "—", not F.
- An unknown coach falls back to the Retriever ranks.
- The result doesn't depend on object key order (shuffled input gives the same output).
- Existing `tests/*.test.cjs` still pass unchanged.

**Node is not installed on this computer.** Before running the tests, ask the user's permission to install Node.js LTS (`winget install OpenJS.NodeJS.LTS`). If they decline, say clearly that the tests were written but not run.

**Manual check in the browser:** every coach theme, all 4 ranges, phone width, keyboard-only use, a level-up, a frozen day, the empty state, and a guest vs signed-in reload.

## Priorities (cut from the bottom if time runs short)

- **P0:** `progress.js` with all rules and tests; Progress page with range toggle, stat tiles and heat map; Today card (level, rank, XP bar); streak flames on habit cards; view switching.
- **P1:** trend chart, per-habit detail dialog, weekly report card, level-up pop-up.
- **P2:** coach verdicts, day-detail dialog, XP-lost toast, polish.

**Timeline tonight:** feature freeze 21:30 → open a PR to `main` and have a teammate review it → merge by 22:30 → check the README and that all tests pass on `main` → buffer until 23:59.

## Out of scope

Badges and achievements, sharing and export (image, CSV), leaderboards and friends comparisons, new Supabase tables, server-side XP, backfilling history the app never recorded, and editing past days.

## Done when

- [ ] All P0 items work in the browser for every coach theme, on desktop and at 360 px width.
- [ ] `tests/progress.test.cjs` covers every rule above, and all tests pass (or the user knows they couldn't be run).
- [ ] No new runtime dependencies; no console errors.
- [ ] README updated; changes reviewed and merged to `main` before 23:59.
