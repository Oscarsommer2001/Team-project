# Guilt Trip

A habit tracker with five illustrated accountability coaches, browser-only guest mode, and optional Supabase accounts.

See [GRADING.md](GRADING.md) for the grading criteria this project is assessed against.

## Open the website

After cloning or pulling the latest project, copy this **whole block** into Terminal on Oscar’s Mac:

```sh
cd "$HOME/Documents/GitHub/Team project"
uv sync --locked
uv run python app.py
```

**Teammates:** replace the folder in the first line with the folder where you cloned this repository. Keep all three lines together. If the first line reports that the folder does not exist, correct that path before continuing.

The website opens automatically at http://localhost:8000. Keep Terminal open while using it; press Ctrl+C to stop. You can use the same block every time you open a new Terminal window.

If you see “No pyproject.toml found” or “can’t open app.py”, Terminal is in the wrong folder. Start with the `cd` line above.

Install uv first if it is not already available on your Mac. No extra Python packages or API keys are needed. GitHub access is only needed to download or update the project; launching an existing copy works locally.

You can also double-click **Start Website.command** on a Mac with Python 3 installed.

If port 8000 is occupied by an older server, stop that server with Ctrl+C first. Guest habits stay in the current browser. Signed-in habits are saved privately to each account.

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
- Weekly totals, completion rates, scheduled-day streaks and 28-day heat map
- Completion milestones and persistent focus timer
- Profile, full-name personalization, reminder preferences and JSON export
- Supabase email/password sign-up, login/logout and private account saving
- Migration from the earlier nudge-v1 local storage, leaving the original copy intact

## Data and rules

Guest data stays in this browser under unfuck-day-v2. Signed-in data is stored in Supabase with per-user access rules. Guest data is never uploaded automatically. The browser stores the login session; unsaved account drafts stay in this tab’s session storage under the account ID. No live AI or social integration is included. Use the same host/port and browser to keep accessing guest data.

Completed records keep their target and name at the time of completion. Previous days are not rewritten when a goal changes. Deleting a habit is the one exception: after a confirmation it removes the habit and all its check-ins for good (archiving keeps them). Unfinished scheduled goals are missed after local midnight, calculated when the page is running or next opened. Postponed goals stay open until then. Unscheduled days do not break streaks. Today's unfinished goals do not break streaks or count as missed. Weekly completion rate includes past scheduled opportunities and today's completions. Targets currently mean 'at least'; upper-limit goals need a later enhancement.

Reminders appear only while the page is running, at the configured minute. Sleeping/background tabs can delay them. Device-local time controls schedules. Notifications outside the website are not implemented.

## Project files

- dist/index.html: screen structure
- dist/style.css: responsive design
- dist/app.js: interface, local persistence, migration and timer
- dist/core.js: scheduling, snapshots, completion rate and streak helpers
- dist/personas.js: names, descriptions and preset character messages
- dist/habit-setup.js: the ready-made habit library and the rule for deleting a habit
- dist/assets/: generated character portraits
- dist/assets/coaches/: pixel-art coach sprites (transparent PNG, one per coach and mood), built from tools/coach-sprites.json with `python tools/build_sprites.py`
- tests/habit-library.test.cjs: every ready-made habit fits the habit form and the account check
- tests/habit-delete.test.cjs: deleting a habit, including refused deletes and edge cases
- tests/core.test.cjs: scheduling and progress regression checks

Run checks with Node.js:

```sh
node tests/core.test.cjs
```

## Next phases

- Production email delivery and verified sign-ups
- Flexible weekly counts, upper-limit targets and surveys
- Weekly coach reviews and richer badges
- Push notifications
- Friends, sharing and privacy controls

Never commit credentials, personal exports or browser data.

## Agent visuals

Selecting an agent changes the palette, fonts, card design, notifications and pop-ups. Retriever successes trigger brief confetti and a wagging tail. Younger You uses notebook styling. Coworker uses ticket cards. Mum uses fridge notes and a clearly fictional cousin comparison. Sergeant uses mission labels and ranks (5 wins for Private, 25 for Sergeant). Reduced-motion preferences disable animation. Fonts load from Google Fonts, with local fallbacks. New portraits were generated with the built-in image tool; assets remain in dist/assets.

## Daily coach push notifications

Log in, open **Profile & settings**, save your check-in time, and choose **Enable daily push**. Then use **Send test notification**. The Supabase daily scheduler is live; notifications are opt-in on each device. For phone access, the frontend needs an HTTPS URL. See [push setup and verification](docs/PUSH-NOTIFICATIONS.md).
