-- Daily check-ins. Private keys never leave the backend.
begin;
create schema if not exists push_private;
revoke all on schema push_private from public, anon, authenticated;
create table push_private.settings (
  id boolean primary key default true check(id),
  cron_token text not null default encode(extensions.gen_random_bytes(32),'hex'),
  vapid jsonb
);
alter table push_private.settings enable row level security;
insert into push_private.settings(id) values(true);
create table public.push_devices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  timezone text not null,
  enabled boolean not null default true,
  expires_at timestamptz not null default now()+interval '60 days',
  last_day date,
  last_test_at timestamptz,
  delivery_status text,
  updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant all on public.push_devices to service_role;
create index push_devices_owner on public.push_devices(user_id);

create function public.push_settings(candidate jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if candidate is not null then
    update push_private.settings set vapid=candidate where id and vapid is null;
  end if;
  select jsonb_build_object('cron_token',cron_token,'vapid',vapid) into result
    from push_private.settings where id;
  return result;
end $$;
revoke all on function public.push_settings(jsonb) from public, anon, authenticated;
grant execute on function public.push_settings(jsonb) to service_role;

-- Claim before network delivery: at most one daily attempt per device, including
-- overlapping workers and repeated DST hours. Never retry an uncertain delivery.
create function public.claim_daily_push() returns table(device_id text, owner_id uuid, subscription jsonb, coach text, day date)
language plpgsql security definer set search_path='' as $$
begin
  return query
  with due as (
    select d.id, (now() at time zone d.timezone)::date as local_day, a.payload->>'tone' as tone
    from public.push_devices d join public.habit_accounts a on a.user_id=d.user_id
    where d.enabled and d.expires_at>now()
      and coalesce(a.payload->>'paused','false')='false'
      and coalesce(a.payload->>'reminders','true')='true'
      and (a.payload->>'checkinTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and to_char(now() at time zone d.timezone,'HH24:MI') >= a.payload->>'checkinTime'
      and (now() at time zone d.timezone) < ((now() at time zone d.timezone)::date + (case when (a.payload->>'checkinTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (a.payload->>'checkinTime')::time end) + interval '5 minutes')
      and d.last_day is distinct from (now() at time zone d.timezone)::date
    order by d.updated_at limit 100 for update of d skip locked
  ), claimed as (
    update public.push_devices d set last_day=due.local_day, delivery_status='attempting'
    from due where d.id=due.id
    returning d.id,d.user_id,d.subscription,due.tone,due.local_day
  ) select * from claimed;
end $$;
revoke all on function public.claim_daily_push() from public, anon, authenticated;
grant execute on function public.claim_daily_push() to service_role;

create function public.claim_push_test(device text, owner uuid) returns boolean
language sql security definer set search_path='' as $$
  with updated as (
    update public.push_devices set last_test_at=now()
    where id=device and user_id=owner and enabled
      and (last_test_at is null or last_test_at<now()-interval '60 seconds') returning id
  ) select exists(select 1 from updated);
$$;
revoke all on function public.claim_push_test(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_push_test(text,uuid) to service_role;
commit;
