# Shove — Product Brief

*Your aggressive habit tracker.*

| | |
| --- | --- |
| **Author** | Product owner, Team Shove |
| **Status** | Draft v1 for team review |
| **Date** | 10 Nov 2026 |
| **Repository deadline** | 23 Nov 2026, 23:59 (final code on `main`) |
| **Presentations** | 24 Nov or 4 Dec 2026 (live demo at the public URL + repository walkthrough) |
| **Grading reference** | [GRADING.md](../GRADING.md) |

---

## 1. Why we are building this

Most habit trackers fail the same way: they politely remind you, you politely ignore them, and the app goes quiet. Shove treats motivation as a personality problem, not a calendar problem. Different people respond to different pressure: some need a cheerleader, some need guilt, some need someone yelling at them.

Shove pairs every user with a **coach** whose personality and level of "meanness" match what actually works for them. A short, funny quiz at sign-up finds that match. The coach then reacts to everything the user does — completing, postponing or missing a habit — in its own voice, which escalates the longer the user slacks off.

Under the jokes, Shove is a real tool: measurable goals, schedules, streaks, stats, a weekly report card, reminders that reach you outside the app, and friends who can see (and roast) your progress.

### Product goals

1. **Get people to their first completed habit within 3 minutes of landing on the site.**
2. **Make the coach feel personal** — the right coach, the right tone, the user's name, the user's actual habits.
3. **Bring people back** — reminders by browser push and email, streaks, report cards and friends.
4. **Never be cruel by accident** — "mean" is always opt-in, calibrated, and has hard limits.

### How this maps to our grade

| Criterion | What earns "High" for Shove | Where in this brief |
| --- | --- | --- |
| 1. It works (20%) | Every workflow in §5 runs on the deployed URL, including the rejected/invalid cases listed for each feature. | §5, §9 |
| 2. UI/UX (20%) | Quiz → coach → first habit in under 3 minutes; every action shows a clear result or a clear error. | §4, §5 |
| 3. Scope (20%) | Accounts, quiz, AI coach, push + email, full social layer with leaderboards and challenges — a 4-person product, not a solo one. | §5 |
| 4. Verification (10%) | Tests for every accepted action, every rejected action and listed edge cases; all pass on `main`. | §10 |
| 5. Security (10%) | Database-enforced access control, validated input, no secrets in git, few pinned dependencies with no known vulnerabilities. | §8 |
| 6. Walkthrough (20%) | Every member can explain how, why, limits and how it could change. | §12, §13 |

---

## 2. Who it is for

**Primary user — "the self-aware procrastinator".** Students and young professionals (18–35) who know what they should do (read, exercise, drink water, sleep earlier), have tried habit apps before, and stopped opening them. They like internet humour and respond better to a joke than a lecture.

**Secondary user — "the accountability friend".** Someone who joins because a friend invited them to a challenge. They may never set many habits of their own; their first experience must be fast and fun.

### User needs

- "I want to set up my habits quickly without reading instructions."
- "I want reminders that I actually notice, even when the app is closed."
- "I want to choose how harsh it is — and change my mind."
- "I want to see whether I'm improving."
- "I want my friends to keep me honest, but I decide what they see."

---

## 3. The coaches

The five coaches are already designed (portraits, palettes, fonts and card styles exist in the current app). Each one restyles the whole interface.

| Level | Coach | Voice | Example |
| --- | --- | --- | --- |
| 1/5 | **Overly Supportive Golden Retriever** | Endlessly positive; the guilt sneaks in through enthusiasm. | "You didn't go to the gym but that's okay!! I'll just wait by the door. Forever." |
| 2/5 | **Disappointed Younger You** | Not angry, just sad. Lowercase, lots of "…". | "i used to think we'd be the kind of person who reads. anyway. goodnight." |
| 3/5 | **Passive-Aggressive Coworker** | Corporate speak, fake politeness, ticket numbers. | "Per my last 4 reminders, just circling back on the water drinking. Thanks in advance 🙂" |
| 4/5 | **Angry Mum** | Loud, dramatic, uses your full name, brings up your cousin. | "I didn't raise you to skip stretching. Your cousin stretches. TWICE a day. Love, Mum" |
| 5/5 | **Drill Sergeant** | All caps, zero mercy, wants you to win. | "DID I STUTTER, RECRUIT? THOSE PUSH-UPS WILL NOT DO THEMSELVES!" |

**Escalation.** Each coach has three intensity steps for a habit: *nudge* (first reminder), *pressure* (missed once, or postponed twice) and *full character* (missed two or more scheduled days in a row). Success always gets praise in the coach's voice, grudging or otherwise.

**Humour style** (from the quiz) changes *how* the chosen coach writes, not *who* the coach is:

| Style | Effect on messages |
| --- | --- |
| Wholesome | Warm wordplay, no sarcasm. |
| Sarcastic | Irony and backhanded compliments. |
| Absurd | Surreal exaggeration ("I've alerted the council of houseplants"). |
| Dry | Deadpan, short, understated. |
| Dramatic | Theatrical over-reaction. |

**Hard limits for every coach and style** (not configurable): no insults about body, weight, appearance, health conditions, identity, money or family trauma; no swearing beyond mild words; no threats; never mocks a habit the user marks as health-sensitive; always ends a "missed" message with a doable next step.

---

## 4. Experience principles (user-friendliness)

These apply to every screen and are part of "done" for every feature.

1. **Three minutes to value.** Sign-up, quiz, coach and first habit fit in one guided flow with a progress bar. No empty screens: starter habit templates are offered at every empty state.
2. **One primary action per screen.** The dashboard's main action is "Done" on today's habits. Everything else is secondary.
3. **Always say what happened.** Every action ends in visible feedback: a coach pop-up, a toast or an inline message. Errors say what went wrong *and* how to fix it, in plain language (the coach can joke, but the fix must be clear).
4. **Forgiving.** Undo for completing a habit (10 seconds), confirmation only for destructive actions (delete habit, delete account, remove friend), nothing lost on a failed network call.
5. **The joke never blocks the task.** Every coach theme keeps readable contrast, normal button positions and plain labels next to themed ones ("MISSION — Habit").
6. **Accessible.** Keyboard usable, visible focus, labels on every form field, WCAG AA contrast in all five themes, respects reduced-motion (already implemented), works from 360 px phone width to desktop.
7. **In control.** The user can change coach, meanness, humour style, notification times and privacy at any time from one settings page, and can retake the quiz.

---

## 5. Features

Priorities: **Must** = required for the 23 Nov submission. **Should** = planned for 23 Nov, first to cut if late. **Could** = only if time allows. Each feature lists acceptance scenarios; rejected scenarios must leave saved data unchanged.

### F1. Accounts — Must

**What.** Sign up with email and password; email verification; log in, log out; reset forgotten password; change password; delete account. Each user only ever sees their own private data.

**Acceptance scenarios**

- ✅ A new visitor signs up with a valid email and an 8+ character password → receives a verification email → after verifying, lands in the onboarding quiz.
- ✅ A returning user logs in → lands on their dashboard with their coach theme applied.
- ✅ A user requests a password reset → receives an email link → sets a new password → can log in with it.
- ✅ A user deletes their account after typing "DELETE" → all their habits, logs, friendships and messages are removed; they are logged out.
- ❌ Sign-up with an email already in use → "That email already has an account — log in or reset your password." No duplicate account.
- ❌ Sign-up with a password under 8 characters or an invalid email → inline error on the field; nothing sent.
- ❌ Login with a wrong password → generic "Email or password is incorrect" (does not reveal which).
- ❌ A logged-out visitor opens `/dashboard` → redirected to login.

**Existing local data.** A user who has habits in the old local-only version is offered "Import my habits from this browser" once after first login.

### F2. Onboarding quiz — Must

**What.** A short, funny quiz (8 questions, about 90 seconds) that measures two things: **how much roasting you can handle** (meanness 1–5) and **your humour style** (one of five). One question per screen, large tappable answer cards, a progress bar, back button, and "Skip quiz" (which defaults to level 3 / Dry and lets the user pick a coach directly).

**Question design.** Scenario questions are more fun and more honest than "how mean do you want it?" sliders. Examples:

| # | Question | Measures |
| --- | --- | --- |
| 1 | It's 7 am and your alarm goes off. Which voice gets you out of bed? *(five answers in each coach's voice)* | Meanness |
| 2 | A friend roasts your outfit. You… laugh / roast back / feel a bit hurt / … | Meanness |
| 3 | Pick the reminder you'd actually obey. | Meanness |
| 4 | When you fail at something, you want to hear… "it's okay" … "do better" … | Meanness |
| 5 | Pick the funniest caption for this photo of a cat ignoring a treadmill. | Humour style |
| 6 | Pick the meme your group chat would send. | Humour style |
| 7 | Which sentence made you smile? | Humour style |
| 8 | Anything the coach should never joke about? *(tick boxes: health, body, studies, work, none)* | Sensitive topics |

**Scoring.** Each meanness answer scores 1–5; the recommended coach is the rounded average. Each humour answer adds a point to one style; ties are broken by the last humour answer. Scoring lives in one pure function so it can be tested directly.

**Result screen.** Shows the recommended coach (portrait, name, meanness level, one sample message written for the user's humour style) and a one-line reason ("You laughed at the roast but want a plan — you get the Coworker."). The user can **Accept** or **See all coaches** and pick any other. They can retake the quiz any time from settings; their habits are kept.

**Acceptance scenarios**

- ✅ A user answers all 8 questions → sees exactly one recommended coach and a humour style → Accept saves both to their profile.
- ✅ A user picks a different coach on the result screen → that coach is saved; the humour style is kept.
- ✅ Same answers always produce the same result (deterministic scoring).
- ✅ Retaking the quiz changes coach/style but leaves habits, logs and streaks untouched.
- ❌ A user tries to submit with an unanswered question → "Next" is disabled and the question is highlighted.
- ❌ A crafted request saves a meanness of 7 or an unknown humour style → rejected by the database; profile unchanged.

### F3. Coach and personalisation — Must

**What.** The chosen coach restyles the app (palette, fonts, cards, avatar, notification style — already built for all five) and speaks in every pop-up, reminder, email and report card. Users can change coach, meanness override and humour style any time. Angry Mum uses the user's full name; others use the first name.

- ✅ Switching coach immediately restyles the app and future messages; history is kept.
- ❌ Selecting a coach ID that doesn't exist → rejected; current coach unchanged.

### F4. Habits and goals — Must

**What.** Create, edit, pause, archive, restore and delete habits (most of this exists in the current app and moves to the database).

- Name (1–60 characters), category (fitness, health, productivity, personal development, custom), optional health-sensitive flag.
- Measurable target: amount + unit (e.g. 20 pages, 5 km, 8 glasses), "at least".
- Schedule: daily, selected weekdays, or **X times per week** (new).
- Reminder time (optional, per habit).
- Visibility: private (default) or friends.
- Starter templates and a "suggest habits" option based on the quiz.

**Acceptance scenarios**

- ✅ Create "Read — 20 pages — Mon/Wed/Fri at 21:00" → appears on today's list on those days only.
- ✅ Edit a target → today and future days use the new target; past completions keep the old one.
- ✅ Pause a habit → it disappears from today and does not break its streak; resume restores it.
- ✅ Log 12 of 20 pages → shown as partial, not complete; logging 20 completes it.
- ❌ Empty name, name over 60 characters, target ≤ 0 or > 10 000, no weekday selected → inline error; nothing saved.
- ❌ Logging a completion for a future date or for another user's habit → rejected.
- ❌ Creating a 51st active habit → "You've hit 50 active habits — archive one first."

### F5. Home dashboard and daily check-in — Must

**What.** The screen users land on every time: today's habits with one-tap "Done", amount logging, "Postpone to later today", daily progress ring, weekly progress, the latest coach message, and an evening check-in prompt ("3 habits still open — what happened?").

- ✅ Tap "Done" → habit marked complete, progress ring updates, coach pop-up appears, undo available for 10 seconds.
- ✅ Postpone → stays open until midnight; coach responds with a postponement message; a second postpone escalates the tone.
- ✅ At local midnight, unfinished scheduled habits become "missed" (already implemented logic, moved to the server for reliability).
- ❌ Double-tapping "Done" → logged once, not twice.
- ❌ Network failure while saving → "Couldn't save — retrying" and the change is retried; never shown as saved when it isn't.

### F6. Progress, report card and badges — Must (badges: Should)

**What.**

- Streaks per habit (scheduled days only; paused or unscheduled days don't break streaks — existing rules).
- Completion rate per habit and overall (week, month).
- 28-day heat map calendar (exists) and weekly/monthly bar charts.
- **Weekly report card** every Monday: grades per habit (A–F from completion rate), best streak, worst habit, and a short verdict written by the coach. Shown in-app and sent by email.
- **Badges** (Should): first habit, 7-day streak, 30-day streak, 100 completions, perfect week, comeback (complete a habit after missing 3), challenge winner. Sergeant ranks stay as the Sergeant's badge style.

- ✅ A habit completed on all 5 scheduled days of a week gets an A and 100%.
- ✅ The report card shows the same numbers as the progress page.
- ✅ Edge case: a habit created on Thursday is only graded on its scheduled days from Thursday on.
- ❌ A week with no scheduled days for a habit → "No grade — not scheduled", not an F.

### F7. AI coach messages — Must

**What.** Coach messages (completion, postponement, missed, reminders, report card verdicts) are generated by a language model in the coach's voice and the user's humour style. **Every message has a hand-written fallback** (the current preset message bank), so the app works when the model doesn't.

**How it works.**

1. The app asks our server function for a message with: coach, humour style, situation (completed / postponed / missed / reminder / report), intensity step, habit name, category, streak length and sensitive topics to avoid.
2. **No personal data goes to the model**: no email, no full name, no friends. The model writes `{name}` and the app inserts the name afterwards.
3. The function checks the output before using it: length ≤ 280 characters, contains no blocked words or forbidden topics, no links, and `{name}` is the only placeholder. If any check fails, or the model takes more than 5 seconds or errors, a preset message is used.
4. Generated messages are cached and reused; each user has a daily cap (e.g. 30 generated messages). Above the cap, presets are used.
5. The API key lives only in the server function's environment settings, never in the browser or the repository.

- ✅ Completing a habit with the Sergeant/Absurd profile → an all-caps, absurd message mentioning the habit.
- ✅ The model is down → the user still gets a preset message instantly; nothing breaks.
- ❌ The model returns a message with a forbidden topic, a link or 1 000 characters → discarded; preset used.
- ❌ Tests never call the real model — they use fake responses (including bad ones) to check the validation.

### F8. Notifications: browser push and email — Must (email report card: Must; push: Must; per-habit quiet hours: Could)

**What.** Reminders reach the user when the app is closed.

- **Browser push** (Web Push via a service worker; works on desktop browsers and Android, and on iPhone once Shove is added to the Home Screen — the app explains this). Used for: per-habit reminders, escalating missed-habit nudges, friend requests, challenge updates.
- **Email** for: account emails (verify, reset), the daily check-in summary (opt-in) and the weekly report card (opt-in, on by default), all in the coach's voice. Every email has a one-click unsubscribe link.
- **In-app inbox** keeps every message the coach sent, so nothing is lost if notifications are blocked.
- **Preferences:** on/off per channel and per type, daily check-in time, quiet hours (no push between e.g. 22:00 and 08:00), and "pause all for today".
- Scheduling runs on the server (a scheduled job every few minutes), not in an open tab.

- ✅ A habit with a 21:00 reminder, not yet done → push arrives at 21:00 (± 5 min) in the coach's voice; clicking it opens the dashboard.
- ✅ The habit was already completed at 20:00 → no reminder is sent.
- ✅ The user blocked push in the browser → the app shows "Push is off — turn it on in your browser settings, or we'll email you instead" and falls back to in-app + email.
- ❌ Quiet hours → no push is sent inside them; it is queued until they end (or dropped if the habit's day has ended).
- ❌ More than 6 pushes per user per day → extra ones go to the in-app inbox only (protects users and free-tier limits).

### F9. Friends and social — Must (friends, feed, privacy) / Should (leaderboards, challenges)

**What.** A full social layer for accountability, with privacy by default.

- **Find and add friends** by unique username or invite link; send, accept, decline, cancel requests; remove or block a friend.
- **Friend profiles:** coach, shared habits, streaks, badges — only what that friend made visible.
- **Social feed:** automatic events from friends' visible habits ("Alex completed a 10-day running streak"), newest first.
- **Reactions:** emoji reactions plus a "send a nudge" button that delivers a preset message *in the receiver's coach voice* ("Your friend asked me to remind you: DROP AND GIVE ME TWENTY"). No free-text messages between users (avoids harassment and moderation work).
- **Habit inspiration:** copy a friend's visible habit to your own list.
- **Leaderboards** (friends only): weekly completion rate, longest current streak, badges earned.
- **Friend challenges:** create a challenge (title, metric — completions or a habit's amount, e.g. km — start and end date, up to 10 friends); invite; accept/decline; live standings; winner gets a badge and the loser gets a message from their own coach.
- **Privacy settings:** profile visibility (friends / nobody), per-habit visibility (private by default), hide from leaderboards, and "who can send me friend requests".

**Access rules** (enforced by the database, see §8):

- Only accepted friends can see a user's profile, feed events and leaderboard rows — and only for habits marked friends-visible.
- Private habits never appear anywhere outside the owner's account, including in counts.

**Acceptance scenarios**

- ✅ A sends a request to B → B gets a push and sees it → B accepts → both appear in each other's friends list and feeds.
- ✅ B marks "Meditation" private → A cannot see it on B's profile, feed or leaderboard, even through a direct request.
- ✅ A challenge for "Run — most km in November" ranks participants by logged km and announces the winner the day after it ends.
- ❌ Sending a request to yourself, to an unknown username, or a duplicate request → clear error; nothing created.
- ❌ Reacting to or viewing a non-friend's event → rejected.
- ❌ A blocked user tries to send a request → it is not delivered and nothing is created. The sender isn't told they are blocked (privacy), so they see the same "request can't be sent" message as for an unknown username.
- ❌ Joining a challenge after it ended, or a challenge with 11 participants → rejected with a message.
- ❌ Nudging the same friend more than 3 times a day → "Easy — they've been nudged enough today."

### F10. Profile and settings — Must

Edit display name, full name, username (unique, 3–20 letters/numbers/underscore) and avatar (choose from coach-styled presets; no photo uploads, to avoid storing images); change coach, meanness and humour; retake quiz; notification preferences; privacy controls; export my data (JSON — exists); change password; log out; delete account.

- ❌ Username taken or containing spaces/symbols → inline error; unchanged.

### F11. Installable web app — Should

Manifest, icons and a service worker so Shove can be "installed" from the browser (needed for push on iPhone). Offline: the dashboard shows the last loaded habits read-only with "You're offline — changes will sync when you're back" (Could: queue completions offline).

### Out of scope (23 Nov)

Native iOS/Android apps; login with Facebook/Instagram/Google; free-text chat between users; photo uploads; payments; automatic tracking from fitness apps or screen-time APIs (all habits are self-reported); "at most" goals such as limiting screen time (Could, if time allows); languages other than English.

---

## 6. Navigation

```
Landing ── Sign up ── Verify email ── Quiz (8 steps) ── Coach result ── First habit ── Dashboard
                           └── Log in ─────────────────────────────────────────────────┘

Top navigation (bottom tab bar on mobile):
  Today       dashboard, check-in, coach message
  Progress    stats, calendar, report cards, badges
  Friends     feed, friends, leaderboards, challenges
  Inbox       all coach messages and notifications
  Profile     settings, coach, quiz, privacy, notifications, account
```

---

## 7. Technical approach

**Stack decision.** Keep the existing plain HTML/CSS/JavaScript front end (no framework, no build step) and add **Supabase** as the backend for accounts, the Postgres database, access rules and server functions. This reuses the most finished work and is the simplest way to get accounts, shared data and scheduled jobs.

> ⚠️ **Action this week:** the course default is Python. Moving away from Python **must be approved by the teaching staff before we commit**. The product owner asks on 10–11 Nov, with this brief attached. If refused, fall back to Python (FastAPI) serving the same HTML/CSS/JS pages, with the same database design.

| Part | Choice | Why |
| --- | --- | --- |
| Front end | Existing vanilla JS, HTML, CSS (`dist/`) | Already built; zero dependencies; every member can read it. |
| Accounts | Supabase Auth (email + password, verification, reset) | We never store passwords ourselves (course advice). |
| Database | Supabase Postgres with Row Level Security | Survives restarts and deploys; shared between users; access rules enforced in the database. |
| Server logic | Supabase Edge Functions | Keeps the AI key, push keys and email key off the browser. |
| Scheduled jobs | Supabase scheduled jobs (cron) every 5 min + daily + Monday | Reminders, missed-day processing, report cards, challenge results. |
| AI messages | OpenAI-compatible API via a free/cheap provider (e.g. Groq or OpenRouter) | Easy to swap provider via configuration; spending cap set in the provider dashboard. |
| Push | Web Push with VAPID keys + service worker | Standard browser push; no extra service. |
| Email | Resend or Brevo free tier | Daily limits are enough for a class demo. |
| Hosting | Static hosting with auto-deploy from `main` (Netlify, Vercel or Cloudflare Pages) | The front end is static files; the backend is Supabase. |

**Data model (first version).** One owner for the database structure (see §12).

- `profiles` — user id, username, display name, full name, coach, meanness, humour style, sensitive topics, timezone, notification and privacy preferences
- `habits` — owner, name, category, target amount + unit, schedule, reminder time, visibility, status (active/paused/archived), health-sensitive flag
- `habit_logs` — habit, date, amount, status (done/partial/postponed/missed), snapshot of target and name
- `coach_messages` — user, situation, text, source (ai/preset), created at, read at
- `friendships` — requester, addressee, status (pending/accepted/declined/blocked)
- `feed_events`, `reactions`, `nudges`
- `challenges`, `challenge_participants`
- `badges`, `user_badges`
- `push_subscriptions`, `notification_queue`

**Project structure.** Keep logic testable by separating it from screens:

- `dist/core.js` — pure rules: schedules, streaks, completion rates, grades (exists)
- `dist/quiz.js` — questions and pure scoring function
- `dist/data.js` — **all** database calls in one module
- `dist/app.js`, `dist/*.js` — screens
- `supabase/migrations/` — database tables, constraints and access rules (versioned)
- `supabase/functions/` — coach-message, send-push, send-email, scheduled jobs
- `tests/` — see §10

---

## 8. Security and privacy

**Access control** — enforced with Postgres Row Level Security, not by hiding buttons. Written as testable rules:

1. A user can read and change only their own profile, habits, logs, messages, subscriptions and preferences.
2. A user can read another user's profile, friends-visible habits, feed events and leaderboard rows only if they are accepted friends and not blocked.
3. A user can create a friend request only as the requester; only the addressee can accept or decline.
4. A user can join a challenge only if invited by a participant, before it ends, and while it has under 10 other participants.
5. Badges, missed-day processing, report cards and challenge results are written only by server functions, never directly by a browser.

**Input validation** — on the form (fast feedback) *and* in the database (constraints) so a crafted request cannot bypass it: lengths, ranges, allowed values (coach 1–5, five humour styles, categories, statuses), unique usernames, no future-dated logs.

**Secrets** — the AI key, email key, VAPID private key and Supabase service key live only in Supabase and hosting environment settings. The only key in the front end is Supabase's public "anon" key, which is safe by design *because* Row Level Security is on. `.env` is in `.gitignore` before it exists; `.env.example` lists the names with placeholders. Rule recorded in `AGENTS.md`.

**Dependencies** — minimal and pinned: the front end loads one library (`@supabase/supabase-js`) at an exact version with an integrity hash; development tools are pinned in `package-lock.json`. `npm audit` must report no known vulnerabilities before submission.

**Privacy** — private by default; no personal data sent to the AI model; no photo uploads; the user can export and delete everything; free text from other users is never displayed (only presets and emoji).

**Rate limits** — AI messages, pushes, nudges and friend requests per user per day (numbers in §5).

---

## 9. Reliability — "what happens if…?"

These are the walkthrough questions we expect, answered in advance:

| If… | Then… |
| --- | --- |
| The AI provider is down or slow | Preset message after 5 s; logged; user never sees an error. |
| The email provider fails | Message stays in the in-app inbox; retried on the next job run. |
| Push is blocked or unsupported (e.g. iPhone not installed) | Clear explanation in settings; in-app inbox + email instead. |
| The free Supabase project paused from inactivity | Owner wakes it the morning of the demo (checklist §13). |
| A user is in another timezone | Days, reminders and midnight processing use the user's saved timezone. |
| Two friends edit a challenge at once | Last valid save wins; the losing save gets "This challenge changed — reload". |

---

## 10. Verification

Target: **every accepted and rejected scenario in §5 has a test, and all tests pass on `main`** (checked before every merge).

| Layer | Tool | Covers |
| --- | --- | --- |
| Pure logic | Node's built-in test runner (no extra dependency) | Schedules, streaks, completion rates, grades, quiz scoring, AI output validation (with fake model responses), escalation steps, rate-limit counters. |
| Access rules | SQL tests against a separate test Supabase project / local Supabase | Every rule in §8 — including the rejected cases (reading a stranger's habit, joining an ended challenge, writing a badge from the browser). |
| End-to-end | Playwright (pinned) against a local or preview deploy | Sign-up → quiz → first habit → done; invalid form inputs; friend request → accept → feed; push permission denied fallback. |
| Manual | Two browsers, deployed URL | Social flows as two users; push on a real phone; email arrival. |

Rules: tests never touch the real database or call the real AI, email or push services; a seed script rebuilds the same demo data (demo users for each coach, friendships and an active challenge); tests are written from this brief before implementation and are not weakened to make code pass.

---

## 11. Repository and delivery checklist

- Public GitHub repository; deployed code on `main`.
- `README.md`: deployed URL; names and student numbers of all four members; commands to run locally; commands to run tests.
- `AGENTS.md`: stack, folder structure, run/test commands, branch rule (work on branches, review before merge, never edit tests to pass), secrets rule, database-structure owner, how to reset demo data.
- `GRADING.md` (exists), `docs/product-brief.md` (this file).
- No keys or passwords anywhere in history.

---

## 12. Team and ownership

Split by feature: each member owns their feature from screen to database, including its tests, and can explain the others.

| Member | Owns | Also owns (shared part) |
| --- | --- | --- |
| Member 1 | F1 Accounts, F2 Quiz, F10 Settings | `AGENTS.md`, README, deployment |
| Member 2 | F4 Habits, F5 Dashboard, F6 Progress & report card | Database structure and migrations |
| Member 3 | F3 Coaches, F7 AI messages, F8 Notifications | Secrets and server functions |
| Member 4 | F9 Friends, feed, leaderboards, challenges | Access rules (RLS) and their tests |

Every change goes through a pull request reviewed by another member, who checks it does what was asked, has tests (including rejected cases) and doesn't touch unrelated files or tests. Rule when `main` breaks: whoever merged last fixes or reverts it the same day.

---

## 13. Timeline (13 days)

| Dates | Milestone |
| --- | --- |
| Tue 10 – Wed 11 Nov | Brief agreed; staff approval for the JS stack; Supabase project; deploy the current app to the public URL; `AGENTS.md`; test runner in place. |
| Thu 12 – Sun 15 Nov | **Core:** accounts, quiz, habits/logs in the database with access rules, dashboard on real data, local-data import. Tests for all of these. |
| Tue 17 Nov (class) | Demo the core to the class teacher; adjust scope. |
| Mon 16 – Thu 19 Nov | **Engagement:** AI messages with fallback, push + email + scheduled jobs, report card, friends + feed + privacy. |
| Fri 20 – Sat 21 Nov | Should items: leaderboards, challenges, badges, installable app. Accessibility pass across all five themes. |
| Sun 22 Nov | **Feature freeze.** Only fixes. `npm audit`, secrets check, README, seed demo data, full test run on `main`. |
| Mon 23 Nov, 23:59 | Submit the repository link on Moodle (one member). |
| Before each presentation | Wake Supabase; open the URL; log in as each demo user; send a test push; rehearse a walkthrough where anyone answers anything. |

**Cut order if late:** challenges → leaderboards → badges → installable app → daily check-in email. Never cut: tests for rejected actions, access rules, fallbacks.

---

## 14. Limits we will state openly (walkthrough)

- Habits are self-reported; Shove can't verify that you ran 5 km.
- Push on iPhone requires adding Shove to the Home Screen.
- Free tiers limit AI messages, emails and database uptime; we cap usage per user to stay inside them.
- AI messages vary between runs, so we test the validation and fallback, not the exact wording.
- **How it could change:** native apps, Google login, automatic tracking from health apps, "at most" goals, moderated free-text chat, paid premium coaches.

---

## 15. Open questions for the team

1. Has the teaching staff approved the JavaScript + Supabase stack? (Blocking — ask first.)
2. Which hosting provider — Netlify, Vercel or Cloudflare Pages? (Pick one that auto-deploys `main` and needs no card.)
3. Which AI provider and model gives the best character voices within a free tier?
4. Final member names, student numbers and feature owners for §12 and the README.
