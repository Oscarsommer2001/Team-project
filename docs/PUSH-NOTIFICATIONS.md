# Daily push check-ins

Daily Web Push is implemented and the Supabase sender/scheduler are live for project `ynbgkskassuaynidlmol` (2026-11-23). This is one daily check-in per opted-in device. Individual habit alerts remain an optional, separate while-open feature.

## Use it

1. Launch the app as usual (`uv sync --locked`, then `uv run python app.py` from this repository).
2. Open it in Chrome or Safari, log in, and open **Profile & settings**.
3. Save the daily check-in time and leave **Enable scheduled coach reminders** checked.
4. Choose **Enable daily push**, accept the browser permission, then **Send test notification**.
5. Keep the browser allowed to run in the background. Browser/OS settings, offline devices, Focus and battery restrictions can delay or prevent delivery.

Daily check-ins use the account's saved coach and time, interpreted in each device's time zone. The device time zone updates when the app is opened. Pausing coach reminders or disabling scheduled reminders pauses daily delivery. **Turn off on this device** disables only that device. Logging out disables and unsubscribes this device; signing in again requires explicit opt-in. Devices expire after 60 days without an app visit.

Localhost is sufficient for testing on a Mac. For phones and a single team URL, deploy `dist/` to an HTTPS host. On iPhone/iPad (iOS/iPadOS 16.4+), add that HTTPS site to the Home Screen and launch it there before enabling push. Changing the website origin requires a new opt-in. A notification can arrive with the local page closed, but opening the local app still requires its terminal server to be running. No public frontend deployment was made in this change.

## Backend

- `002_daily_push.sql` creates private VAPID/cron settings and server-only device storage. Both tables have RLS; browser roles cannot access them or internal scheduling functions.
- `daily-checkin/index.ts` verifies user JWTs through Supabase Auth. Cron uses a separate generated secret. The legacy JWT gateway check is off because it cannot authenticate the cron secret; requests are still authenticated inside the function. Never remove this authentication.
- VAPID signing keys are generated once in the backend and kept in a private schema, with an atomic first-write operation. Only the public signing key reaches the browser. No private keys are committed or copied into the frontend.
- Push destinations are restricted to supported browser providers. HTTPS, no credentials/ports, no redirects and timeouts protect the sender from arbitrary network targets.
- `003_push_schedule.sql` runs once per minute using pg_cron and pg_net. The database stores the scheduler secret and passes it to the function without printing it. The project URL in this migration must be changed for a different project.
- The query claims due devices atomically, using the local calendar date. It respects pause, reminder preferences, expiry and the local time zone. Repeated/overlapping runs and repeated daylight-saving hours cannot claim the same device/day twice.
- Delivery is attempted within five minutes of the saved time, with a five-minute push TTL. There is at most one daily attempt, not guaranteed delivery: unknown/failed deliveries are not retried to avoid duplicate messages. A prolonged service outage may skip a day's check-in. Expired provider subscriptions (404/410) are disabled.
- Test messages have a one-minute per-device cooldown. Up to ten active device records are allowed per account; old inactive records can be reviewed by the project administrator.
- The service worker stores only its account owner ID, never credentials or habits. It discards queued messages for other owners and clears visible notices on logout. Clicking a notification opens/focuses this app, never a sender-supplied external link. It does not cache authenticated pages.

For a fresh environment: apply migration 001, then 002; deploy `daily-checkin` with the included `config.toml`; finally apply 003. These migrations are already applied to the current project—do not rerun 002. Deployment can use the Supabase dashboard editor or the Supabase CLI. Authenticated sender tests and rejected anonymous requests should both be checked after deployment.

To pause all scheduled sends temporarily, run `select cron.alter_job(job_id := (select jobid from cron.job where jobname='guilt-trip-daily-checkin'), active := false);` as the database administrator. Reactivate with `active := true`.

## Verification

```sh
node --test tests/push.test.cjs tests/push-client.test.cjs tests/account-flow.test.cjs tests/accounts.test.cjs tests/core.test.cjs tests/quiz.test.cjs
```

The push sender test uses Node's `stripTypeScriptTypes` (Node 22.13+ / 24 recommended). The runtime app has no new local dependencies. The function also passed Deno type-checking and an actual encrypted/signed Web Push request generation check (without delivery).

`supabase/verify-push.sql` is a rollback-only schedule/isolation check. It passed live for local time, alternate time zones, deduplication, paused/disabled reminders, expired devices, malformed times and private grants.

Live API checks passed: authenticated key retrieval, opt-in/status/opt-out, persistent opt-out, rejecting tests for disabled devices, denying account access to secrets/device tables and rejecting private-network destinations. One synthetic `daily-push-verification` Auth fixture and a disabled fake device were created, with no real personal data and no notification sent. The scheduler returned HTTP 200.

Actual delivery to a user's browser still needs the user to enable permission and press **Send test notification**. Browser permission acceptance and an OS notification were not verified automatically. The pre-existing coach-messages test has an unrelated placeholder/capitalization failure documented in ACCOUNTS.md.

References: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [web-push library](https://github.com/web-push-libs/web-push), [WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
