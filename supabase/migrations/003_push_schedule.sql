-- Apply AFTER daily-checkin has been deployed with application-level authentication.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function push_private.dispatch() returns void
language plpgsql security definer set search_path='' as $$
begin
  perform net.http_post(
    url := 'https://ynbgkskassuaynidlmol.supabase.co/functions/v1/daily-checkin',
    headers := jsonb_build_object('Content-Type','application/json','x-push-cron',
      (select cron_token from push_private.settings where id)),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 15000
  );
end $$;
revoke all on function push_private.dispatch() from public, anon, authenticated;
select cron.schedule('guilt-trip-daily-checkin','* * * * *','select push_private.dispatch()');
