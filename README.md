# Guilt Trip

A habit tracker with five illustrated accountability coaches, browser-only guest mode, and optional Supabase accounts.

See [GRADING.md](GRADING.md) for the grading criteria this project is assessed against.

## Deployed app

Open **[Guilt Trip](https://oscarsommer2001.github.io/Team-project/)** in your browser. No local installation is needed. Guest mode works without an account; sign in to use cloud saving and Friends.

The website is deployed from `dist/` by the **Publish website** GitHub Actions workflow whenever `main` is updated.

## Team members

| Name | Student number |
| --- | --- |
| Andreas Schou | 83866 |
| Claes Kjeldsmark | 81754 |
| Sebastian Strandgaard | 81719 |
| Oscar Sommer | 81792 |
| Lasse Bjørklund Debois | 83460 |

## Run locally

Prerequisites: Git, Python 3.9 or newer, and [uv](https://docs.astral.sh/uv/getting-started/installation/). The Python launcher has no third-party package dependencies. Online account and social features require an internet connection.

For a first-time setup, run:

```sh
git clone https://github.com/Oscarsommer2001/Team-project.git
cd Team-project
uv sync --locked
uv run python app.py
```

If you already cloned the repository, open Terminal in that folder and run:

```sh
git pull --ff-only
uv sync --locked
uv run python app.py
```

The launcher opens [http://localhost:8000](http://localhost:8000) automatically. Keep Terminal open while using the local app; press **Ctrl+C** to stop it. On macOS, you can also double-click `Start Website.command`.

If Terminal reports “No pyproject.toml found” or “can’t open app.py”, first use `cd` to enter your cloned repository. On Oscar’s Mac, that command is:

```sh
cd "$HOME/Documents/GitHub/Team project"
```

If port 8000 is occupied by an older server, stop that server before starting another. Guest habits stay in the current browser and website address; signed-in habits are saved to the account.

## Run tests locally

Install **Node.js 24 LTS**, then run this command from the repository root:

```sh
node --test tests/*.test.cjs
```

This runs every automated JavaScript test and exits with an error if any fail. It covers habit rules, progress, coach messages, the quiz, account flows and push notification behavior. These local tests use mocks where needed and do not require database credentials or send real notifications. No `npm install` is required.

Database access-control checks are separate SQL scripts: `supabase/verify-rls.sql`, `supabase/verify-push.sql`, `supabase/verify-social.sql`, and `supabase/verify-social-competitions.sql`. Run them in a staging Supabase SQL Editor after applying the matching migrations; their test data is rolled back. See [accounts](docs/ACCOUNTS.md) and [push setup](docs/PUSH-NOTIFICATIONS.md) for details.

## Sign up and log in

Click **Sign up / Log in** in the header, choose **Sign up**, and enter an email and a password of at least eight characters. The team prototype signs you in immediately without email confirmation. Use **My account** to log out.

Each account starts fresh. To bring over your existing habits, open **My account → Bring over browser-only habits** and confirm the import. This replaces the account’s current habits with the browser copy, which is kept.

The status bar shows whether changes are saved online. If saving fails, keep the tab open and use **Retry save** or **Download backup**. Refresh after saving on another device to load its latest changes.

**Prototype limitation:** email ownership is not verified and password-reset emails are unavailable until an email service is connected. See [account setup and verification](docs/ACCOUNTS.md).

## Implemented

- Personal habits, categories and a library of 16 ready-made habits in four categories
- Measurable self-reported targets, daily or selected-weekday schedules
- Editing, pausing, archiving, restoring and deleting habits (delete asks first and removes the habit's check-ins for good)
- Completion/postponement pop-ups from five coach personalities
- Progress page: XP and levels, coach-themed ranks, streak flames and streak freezes, completion-rate tiles with period comparison, trend chart, clickable heat-map calendar, per-habit detail and weekly A–F report cards, for 7 days / 30 days / 12 months / all time (see [the spec](docs/specs/progress-gamification.md))
- Guests see a full year of clearly labelled, made-up sample history before their first real day, so the Progress page is never empty. It is generated on the fly, never saved or imported into an account, and can be removed with the "Remove sample data" button in the disclaimer (and brought back later)
- Completion milestones and persistent focus timer
- Profile, full-name personalization, reminder preferences and JSON export
- Supabase email/password sign-up, login/logout and private account saving
- Migration from the earlier nudge-v1 local storage, leaving the original copy intact

## Data and rules

Guest data stays in this browser under unfuck-day-v2. Signed-in data is stored in Supabase with per-user access rules. Guest data is never uploaded automatically. The browser stores the login session; unsaved account drafts stay in this tab’s session storage under the account ID. Use the same host/port and browser to keep accessing guest data.

Completed records keep their target and name at the time of completion. Previous days are not rewritten when a goal changes. Deleting a habit is the one exception: after a confirmation it removes the habit and all its check-ins for good (archiving keeps them). Unfinished scheduled goals are missed after local midnight, calculated when the page is running or next opened. Postponed goals stay open until then. Unscheduled days do not break streaks. Today's unfinished goals do not break streaks or count as missed. Weekly completion rate includes past scheduled opportunities and today's completions. Targets currently mean 'at least'; upper-limit goals need a later enhancement.

Individual habit alerts require the page to be running. Optional daily push check-ins are sent by the Supabase scheduler even when the page is closed. Browser permissions, Focus settings, and offline devices can delay or prevent delivery. See the daily push instructions below.

## Friends

Sign in and open **Friends** to choose a username. **Social feed** shows shared completions with streaks and milestones, challenge posts, and the 7-day leaderboard. Send a reaction and a preset encouragement on the same post. **Notifications** shows requests, reactions, results and shared streaks in one newest-first timeline. **Find friends** searches exact usernames and opens accepted friends’ profiles, where you can copy shared habits into your own editor.

Habit sharing is off by default. Choose individual habits under **Username & sharing**. Accepted friends can see the selected habits’ setup, completion history, streaks and milestones based on shared completions. Clearing a selection removes it from their profiles and feed. Account records and email addresses stay private.

Under **Joint activities**, challenge an accepted friend for 7, 14 or 30 days. Type the habit or activity you want to measure, such as swimming laps. A matching habit is linked automatically, and a new activity is added to Today as a daily habit. If you leave the unit blank, the app uses the matching habit’s unit or counts how many times you do the activity. The recipient can edit the proposed name, and both participants use the same unit. You can also score a competition by active days or completions across all habits.

Choose **Shared goal** to work toward a combined target, such as 100 pages. Both contributions appear under **Joint activities**. Below-target amounts still count in measured activities. The date range starts on the UTC calendar day the invite is accepted. Final results lock on the first view after the time ends or, for a shared goal, when a participant views it after reaching the target. Mutual friends see starts and final results only if both participants opt in. Either participant can withdraw that visibility.

The sender can edit or cancel a pending invite. After acceptance, either participant can edit the name, duration, or shared target, or stop the activity for both. Units and linked habits stay fixed after acceptance so existing scores keep their meaning. Stopped activities appear in Results without a winner, and habit logs remain intact. The other participant sees edits, cancellations, stops, and visibility changes in Notifications the next time they open or refresh Friends.

From Results, choose **Start again** on a stopped activity to edit its details and send a fresh invite. **Remove from my list** hides a result only for you, and you can restore it later. **Manage Today habits** opens the habit manager, where you can archive any tracker you no longer want on Today.

Active goals and competitions show up in **Joint activities today** as well as **Friends → Joint activities**. Both use the same habit log. Saving a daily total or marking a habit complete in either view updates Today and the joint score. To pick up a friend’s latest contribution, use **Refresh scores** on Today or **Refresh** in Friends.

Before deploying the Friends UI, apply `supabase/migrations/004_social.sql` and `supabase/migrations/005_social_competitions.sql` in order. Run `supabase/verify-social.sql` and `supabase/verify-social-competitions.sql` on staging to verify permissions and friend flows using test rows that are rolled back.

## Project files

- dist/index.html: screen structure
- dist/style.css: responsive design
- dist/app.js: interface, local persistence, migration and timer
- dist/core.js: scheduling, snapshots, completion rate and streak helpers
- dist/progress.js: XP, levels, ranks, freeze-aware streaks, ranges, trends and report cards (pure, tested)
- dist/progress-messages.js and dist/progress-ui.js: coach lines and the Progress page, Today level card and level-up pop-up
- dist/personas.js: names, descriptions and preset character messages
- dist/habit-setup.js: the ready-made habit library and the rule for deleting a habit
- dist/assets/: generated character portraits
- dist/assets/coaches/: pixel-art coach sprites (transparent PNG, one per coach and mood), built from tools/coach-sprites.json with `python tools/build_sprites.py`
- tests/habit-library.test.cjs: every ready-made habit fits the habit form and the account check
- tests/habit-delete.test.cjs: deleting a habit, including refused deletes and edge cases
- tests/core.test.cjs: scheduling and progress regression checks
- tests/progress.test.cjs: XP, level, rank, freeze, range and report-card rules, including rejected and edge cases

## Next phases

- Production email delivery and verified sign-ups
- Flexible weekly counts, upper-limit targets and surveys
- Weekly coach reviews and richer badges
- Push reminders for individual habits

Never commit credentials, personal exports or browser data.

## Agent visuals

Selecting an agent changes the palette, fonts, card design, notifications and pop-ups. Retriever successes trigger brief confetti and a wagging tail. Younger You uses notebook styling. Coworker uses ticket cards. Mum uses fridge notes and a clearly fictional cousin comparison. Sergeant uses mission labels and ranks (5 wins for Private, 25 for Sergeant). Reduced-motion preferences disable animation. Fonts load from Google Fonts, with local fallbacks. New portraits were generated with the built-in image tool; assets remain in dist/assets.

## Daily coach push notifications

Log in, open **Profile & settings**, save your check-in time, and choose **Enable daily push**. Then use **Send test notification**. The Supabase daily scheduler is live; notifications are opt-in on each device. For phone access, use the deployed HTTPS URL above. On iPhone/iPad, add the site to the Home Screen and open it there before enabling push. See [push setup and verification](docs/PUSH-NOTIFICATIONS.md).
