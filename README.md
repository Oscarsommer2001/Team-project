# Unf*ck Your Day

A local-first habit tracker with five illustrated accountability coaches.

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

If port 8000 is occupied by an older server, stop that server with Ctrl+C first. Each teammate’s habits stay in their own browser.

## Implemented

- Personal habits, categories and four starter templates
- Measurable self-reported targets, daily or selected-weekday schedules
- Editing, pausing, archiving and restoring habits
- Completion/postponement pop-ups from five coach personalities
- Weekly totals, completion rates, scheduled-day streaks and 28-day heat map
- Completion milestones and persistent focus timer
- Local profile, full-name personalization, reminder preferences and JSON export
- Migration from the earlier nudge-v1 local storage, leaving the original copy intact

## Data and rules

Everything is stored in this browser under unfuck-day-v2. There is no account, cloud sync, live AI or social integration. Use the same host/port and browser to keep accessing your data. Changing between localhost and 127.0.0.1 uses different browser storage.

Completed records keep their target and name at the time of completion. Previous days are not rewritten when a goal changes. Unfinished scheduled goals are missed after local midnight, calculated when the page is running or next opened. Postponed goals stay open until then. Unscheduled days do not break streaks. Today's unfinished goals do not break streaks or count as missed. Weekly completion rate includes past scheduled opportunities and today's completions. Targets currently mean 'at least'; upper-limit goals need a later enhancement.

Reminders appear only while the page is running, at the configured minute. Sleeping/background tabs can delay them. Device-local time controls schedules. Notifications outside the website are not implemented.

## Project files

- dist/index.html: screen structure
- dist/style.css: responsive design
- dist/app.js: interface, local persistence, migration and timer
- dist/core.js: scheduling, snapshots, completion rate and streak helpers
- dist/personas.js: names, descriptions and preset character messages
- dist/assets/: generated character portraits
- dist/assets/coaches/: pixel-art coach sprites (transparent PNG, one per coach and mood), built from tools/coach-sprites.json with `python tools/build_sprites.py`
- tests/core.test.cjs: scheduling and progress regression checks

Run checks with Node.js:

```sh
node tests/core.test.cjs
```

## Next phases

- Hosted authentication and per-user database
- Flexible weekly counts, upper-limit targets and surveys
- Weekly coach reviews and richer badges
- Push notifications
- Friends, sharing and privacy controls

Never commit credentials, personal exports or browser data.

## Agent visuals

Selecting an agent changes the palette, fonts, card design, notifications and pop-ups. Retriever successes trigger brief confetti and a wagging tail. Younger You uses notebook styling. Coworker uses ticket cards. Mum uses fridge notes and a clearly fictional cousin comparison. Sergeant uses mission labels and ranks (5 wins for Private, 25 for Sergeant). Reduced-motion preferences disable animation. Fonts load from Google Fonts, with local fallbacks. New portraits were generated with the built-in image tool; assets remain in dist/assets.
