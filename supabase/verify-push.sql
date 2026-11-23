-- Rollback-only checks: no real subscriptions or users are modified.
begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000221','push-schedule-fixture@example.invalid');
insert into public.habit_accounts(user_id,payload) values('00000000-0000-4000-8000-000000000221',jsonb_build_object('checkinTime',to_char(now() at time zone 'UTC','HH24:MI'),'tone','retriever','reminders',true,'paused',false));
insert into public.push_devices(id,user_id,subscription,timezone) values('push-schedule-fixture','00000000-0000-4000-8000-000000000221','{}','UTC');
do $$
declare n int;
begin
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>1 then raise exception 'Expected one due check-in';end if;
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>0 then raise exception 'Duplicate check-in was claimed';end if;
 update public.push_devices set last_day=null where id='push-schedule-fixture';
 update public.habit_accounts set payload=payload||'{"paused":true}'::jsonb where user_id='00000000-0000-4000-8000-000000000221';
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>0 then raise exception 'Paused account was notified';end if;
 update public.habit_accounts set payload=payload||'{"paused":false,"reminders":false}'::jsonb where user_id='00000000-0000-4000-8000-000000000221';
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>0 then raise exception 'Disabled reminders were notified';end if;
 update public.habit_accounts set payload=payload||'{"reminders":true,"checkinTime":"99:99"}'::jsonb where user_id='00000000-0000-4000-8000-000000000221';
 perform public.claim_daily_push();
 update public.habit_accounts set payload=payload||jsonb_build_object('checkinTime',to_char(now() at time zone 'Asia/Tokyo','HH24:MI')) where user_id='00000000-0000-4000-8000-000000000221';
 update public.push_devices set timezone='Asia/Tokyo' where id='push-schedule-fixture';
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>1 then raise exception 'Timezone check failed';end if;
 update public.push_devices set last_day=null,expires_at=now()-interval '1 day' where id='push-schedule-fixture';
 select count(*) into n from public.claim_daily_push() where device_id='push-schedule-fixture';
 if n<>0 then raise exception 'Expired device was notified';end if;
 if has_function_privilege('authenticated','public.push_settings(jsonb)','EXECUTE') or has_function_privilege('anon','public.claim_daily_push()','EXECUTE') then raise exception 'Internal function exposed';end if;
 if has_table_privilege('authenticated','public.push_devices','SELECT') or has_schema_privilege('anon','push_private','USAGE') then raise exception 'Private subscriptions exposed';end if;
end $$;
rollback;
select 'PASS: due time, timezone, daily deduplication, pause, opt-out, expiry, malformed time, private grants' as result;
