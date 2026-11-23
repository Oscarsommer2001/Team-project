# Supabase accounts

The static app uses Supabase Auth for email/password identity and the Data API for `public.habit_accounts`. The included publishable key is intended for browsers; never replace it with a secret or service-role key.

## Current project

Project `ynbgkskassuaynidlmol` is configured for the team prototype. Its site URL is `http://localhost:8000/`. Email sign-up is enabled and Confirm email is disabled with the owner’s approval. Custom SMTP is not configured. Password recovery is therefore hidden in the interface; its implementation is covered by mocked tests for later activation.

To enable production email, configure custom SMTP, enable Confirm email, configure the actual deployed site URL/allowed redirects, then set `emailDeliveryEnabled: true` in `dist/supabase-config.js`. Verify confirmation and recovery with a real inbox before launch. Supabase’s built-in sender only supports organization-member email addresses: https://supabase.com/docs/guides/auth/auth-smtp

## Data and isolation

- `supabase/migrations/001_accounts.sql` has already been applied to this project. Run it only for a new database, not again on the current project.
- Each account has one JSON document keyed by its Auth user ID. RLS limits SELECT, INSERT and UPDATE to that user; anonymous roles receive no table grants.
- Passwords are handled by Supabase Auth and never written to habit documents or application browser storage.
- Guest habits are separate and imported only after an explicit user choice. Imports replace existing account data and keep the guest copy.
- Account changes are sent serially with an expected revision. The database increments revisions. A stale device cannot silently overwrite a newer document.
- Failed writes remain in memory and, where available, owner-scoped session storage. Retry keeps the expected revision. Conflicts require downloading a backup and reloading the latest online version; there is no automatic merging.
- Logout waits for pending saves. Account changes from another tab hide the old account view and reload it.
- The page loads cloud data before enabling the dashboard. A failed read never falls back to a blank account and overwrites existing data.
- Browser notification permissions stay device-specific. Sync occurs on save; reload to fetch another device’s edits.

## Checks

```sh
node tests/accounts.test.cjs
node tests/account-flow.test.cjs
node tests/core.test.cjs
node tests/quiz.test.cjs
```

Account checks cover serialized writes, revisions, conflicts, retries, user-scoped drafts, explicit import boundaries, sign-up responses, invalid login, password recovery, and failed bootstrap protection. `supabase/verify-rls.sql` is a rollback-only database isolation check.

On 2026-11-23, live checks against the configured project passed for sign-up without confirmation, incorrect-password rejection, login/logout, save/read from a second client, denied cross-account reads/writes, and stale-write rejection. Anonymous REST access returned HTTP 401. Two clearly marked synthetic QA users (`user_metadata.test_fixture = true`) were created; their random passwords were held in memory only. They contain synthetic habits, not user data.

The existing coach-messages test has an unrelated baseline failure: its all-caps assertion counts lowercase `{habit}` placeholders as lowercase dialogue. Account changes do not alter that message bank.
