# Unf*ck Your Day

A local-first habit tracker with five illustrated accountability coaches.

See [GRADING.md](GRADING.md) for the grading criteria this project is assessed against.

## Launch on any teammate’s Mac

Copy this whole line into Terminal. Use the same line every time:

```sh
( app_dir="$HOME/Team-project-app"; if [ ! -d "$app_dir" ]; then git clone https://github.com/Oscarsommer2001/Team-project.git "$app_dir" || exit; fi; git -C "$app_dir" pull --ff-only && python3 "$app_dir/tools/serve.py" )
```

This downloads the project on the first run, gets the latest updates on later runs, and opens the website automatically at http://localhost:8000. Keep Terminal open while using it; press Ctrl+C to stop.

**One-time requirements:** Git and Python 3 must be installed. This is a private repository, so each teammate needs repository access and GitHub authentication configured for Terminal. A GitHub account password will not work for Git authentication. If Terminal reports an authentication error, clone the repository using the signed-in GitHub Desktop app into `~/Team-project-app`, then double-click `Start Website.command` there to launch without a Terminal download.

The repository URL needs the command around it: pasting a URL alone into Terminal does not launch an app. No public website hosting is required. Each teammate’s habits stay in their own browser.

## Run an existing local copy

On a Mac, double-click **Start Website.command**. It starts the website and opens your browser automatically. Keep its Terminal window open while using the app; press Ctrl+C to stop.

Or run this from the project folder:

```sh
sh "Start Website.command"
```

The launcher works even if the project folder is moved or renamed. Python 3 is required; no extra packages or API keys are needed. If port 8000 is occupied by an older server, stop that server with Ctrl+C first.

For future updates, run `git pull` from this folder, then launch again.

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
