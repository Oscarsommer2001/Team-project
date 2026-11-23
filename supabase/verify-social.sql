-- Run against a staging database with the social migration applied.
begin;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-000000000203');
insert into public.habit_accounts(user_id, payload) values
  ('00000000-0000-4000-8000-000000000201',
   '{"fullName":"PRIVATE","goals":[{"id":"run","name":"Run","target":5,"unit":"km","days":[1]},{"id":"hidden","name":"PRIVATE"}],
     "logs":{"2025-01-01":{"run":{"status":"done"}},"2025-01-02":{"run":{"status":"pending"}},
       "2025-01-03":{"run":{"status":"done"},"hidden":{"status":"done"}}}}');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
select public.social_save_profile('verify_alex', array['run']);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000202';
select public.social_save_profile('verify_sam', '{}');
select public.social_connect('verify_alex', 'send');
select public.social_connect('verify_alex', 'accept');
do $$
begin
  if public.social_find('verify_alex') is distinct from 'verify_alex'
    or public.social_find('verify') is not null then raise exception 'Exact username lookup failed'; end if;
  if public.social_network()->'connections'->0->>'status' is distinct from 'outgoing'
    or jsonb_array_length(public.social_activity()->'feed') <> 0 then
    raise exception 'Pending requests must not grant access';
  end if;
  if has_table_privilege('authenticated', 'public.social_profiles', 'SELECT')
    or has_function_privilege('authenticated', 'public.social_shared_goals(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.social_activity()', 'EXECUTE') then
    raise exception 'Direct or anonymous access was granted';
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
select public.social_connect('verify_sam', 'send');
do $$ begin
  if public.social_network()->'connections'->0->>'status' is distinct from 'incoming' then
    raise exception 'A crossed request changed the original request';
  end if;
end $$;
select public.social_connect('verify_sam', 'accept');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000202';
do $$
declare activity jsonb := public.social_activity();
begin
  if exists (select 1 from public.habit_accounts) or activity::text like '%PRIVATE%'
    or jsonb_array_length(activity->'feed') <> 2
    or jsonb_array_length(activity->'habits') <> 1
    or activity->'habits'->0->>'streak' is distinct from '1'
    or activity->'feed'->0->>'streak' is distinct from '1'
    or activity->'feed'->0->>'streakStart' is distinct from '2025-01-03'
    or activity->'feed'->0->>'wins' is distinct from '2'
    or activity->'feed'->1->>'wins' is distinct from '1' then
    raise exception 'Shared projection or private-data isolation failed';
  end if;
end $$;
select public.social_cheer('verify_alex', 'run', '2025-01-03', true);
select public.social_cheer('verify_alex', 'run', '2025-01-03', true);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000203';
select public.social_save_profile('verify_other', '{}');
do $$ begin
  if jsonb_array_length(public.social_activity()->'habits') <> 0 then
    raise exception 'Non-friend received Alex’s activity';
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
do $$ begin
  if jsonb_array_length(public.social_activity()->'received') <> 1 then
    raise exception 'A cheer should appear once for the recipient';
  end if;
end $$;
select public.social_save_profile('verify_alex', '{}');
do $$ begin
  if jsonb_array_length(public.social_activity()->'received') <> 0 then
    raise exception 'Cheers survived withdrawal of sharing';
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000202';
do $$ begin
  if jsonb_array_length(public.social_activity()->'feed') <> 0 then
    raise exception 'Withdrawing a shared habit did not remove it from the feed';
  end if;
end $$;
rollback;
select 'PASS: friend requests, private defaults, sharing, streaks, and cheers.' as result;
