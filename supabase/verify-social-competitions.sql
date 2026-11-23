-- Run on staging after the social migrations. Test rows are rolled back.
begin;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000301'),
  ('00000000-0000-4000-8000-000000000302'),
  ('00000000-0000-4000-8000-000000000303'),
  ('00000000-0000-4000-8000-000000000304');
insert into public.social_profiles(user_id, username, shared_habits) values
  ('00000000-0000-4000-8000-000000000301','challenge_a',array['shared']),
  ('00000000-0000-4000-8000-000000000302','challenge_b',array['shared']),
  ('00000000-0000-4000-8000-000000000303','challenge_c','{}'),
  ('00000000-0000-4000-8000-000000000304','challenge_d','{}');
insert into public.social_friendships(requester, recipient, accepted) values
  ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302',true),
  ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000303',true),
  ('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000303',true),
  ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000304',true);
insert into public.habit_accounts(user_id, payload)
select user_id, jsonb_build_object('goals', '[{"id":"shared","name":"Reading"},{"id":"private","name":"SECRET"}]'::jsonb,
  'logs', jsonb_build_object(
    to_char(current_date, 'YYYY-MM-DD'), '{"shared":{"status":"done"},"private":{"status":"done"}}'::jsonb,
    to_char(current_date - 1, 'YYYY-MM-DD'), '{"shared":{"status":"done"}}'::jsonb))
from public.social_profiles where username in ('challenge_a','challenge_b');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
select public.social_invite_challenge('challenge_b','Test competition','days',7,true);
do $$
declare c jsonb := public.social_competitions()->0;
begin
  if c->>'status' is distinct from 'pending' or c->>'scores' is not null then
    raise exception 'Pending invites must have no scores';
  end if;
  begin
    perform public.social_answer_challenge((c->>'id')::uuid,'accept',true);
    raise sqlstate 'P0002' using message = 'Inviter accepted their own invitation';
  exception when raise_exception then null;
  end;
  if public.social_week()->'rankings'->0->>'score' is distinct from '2'
    or public.social_week()->'rankings'->1->'together' is distinct from
      jsonb_build_array(to_char(current_date, 'YYYY-MM-DD'),to_char(current_date - 1, 'YYYY-MM-DD')) then
    raise exception 'Weekly rankings and shared dates were incorrect';
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
do $$ begin
  if jsonb_array_length(public.social_competitions()) <> 0 then raise exception 'Invite exposed to mutual friend'; end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
select public.social_answer_challenge((public.social_competitions()->0->>'id')::uuid,'accept',true);
do $$ begin
  if public.social_competitions()->0->'scores' is distinct from '[1,1]'::jsonb then
    raise exception 'Active days must count at most once per person per day';
  end if;
end $$;
select public.social_react('challenge_a','shared', to_char(current_date, 'YYYY-MM-DD'),'like');
select public.social_react('challenge_a','shared', to_char(current_date, 'YYYY-MM-DD'),'fire');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000304';
do $$ begin
  if jsonb_array_length(public.social_competitions()) <> 0 then raise exception 'Challenge exposed to non-mutual friend'; end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
do $$
declare c jsonb := public.social_competitions()->0;
begin
  if c->>'status' is distinct from 'accepted' or c->>'scores' is not null then
    raise exception 'Mutual friends should see the start without live scores';
  end if;
  perform public.social_react_challenge((c->>'id')::uuid,'started','cheer');
end $$;

reset role;
-- Move the test challenge into the past and use completion scoring to verify a second metric.
update public.social_challenges set starts_on = current_date-7, ends_on = current_date-1, metric = 'completions'
where challenger = '00000000-0000-4000-8000-000000000301';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
do $$
declare c jsonb := public.social_competitions()->0;
begin
  if c->>'status' is distinct from 'finished' or c->'scores' is distinct from '[1,1]'::jsonb then
    raise exception 'Final score must use the challenge date range';
  end if;
  if public.social_challenge_alerts()->0->>'reaction' is distinct from 'cheer'
    or public.social_activity()->'received'->0->>'reaction' is distinct from 'fire'
    or jsonb_array_length(public.social_activity()->'received') <> 1 then
    raise exception 'Reaction replacement and alerts were incorrect';
  end if;
  perform public.social_answer_challenge((c->>'id')::uuid,'hide',false);
end $$;
update public.habit_accounts set payload = '{}' where user_id = '00000000-0000-4000-8000-000000000301';
do $$ begin
  if public.social_competitions()->0->'scores' is distinct from '[1,1]'::jsonb then
    raise exception 'Final scores changed after a habit edit';
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
do $$ begin
  if jsonb_array_length(public.social_competitions()) <> 0 then raise exception 'Hidden challenge remained visible'; end if;
  if has_table_privilege('authenticated', 'public.social_challenges', 'SELECT')
    or has_function_privilege('authenticated', 'public.social_challenge_score(uuid,text,date,date,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.social_competitions()', 'EXECUTE') then
    raise exception 'Direct or anonymous challenge access was granted';
  end if;
end $$;

reset role;
update public.habit_accounts set payload = jsonb_build_object(
  'goals', '[{"id":"run","name":"Run","unit":"kilometres"},{"id":"read","name":"Read","unit":"pages"}]'::jsonb,
  'logs', jsonb_build_object(to_char(current_date, 'YYYY-MM-DD'),
    '{"run":{"status":"pending","value":2.5,"unit":"km"},"read":{"status":"done","value":50,"unit":"pages"}}'::jsonb))
where user_id in ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
select public.social_invite_challenge('challenge_b','Distance test','amount',7,false,'run');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance test');
begin
  begin
    perform public.social_answer_challenge((c->>'id')::uuid,'accept',false,'read');
    raise sqlstate 'P0002' using message = 'Different units were accepted';
  exception when raise_exception then null;
  end;
  perform public.social_answer_challenge((c->>'id')::uuid,'accept',false,'run');
  select value into c from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance test';
  if c->>'unit' is distinct from 'km' or c->'scores' is distinct from '[2.5,2.5]'::jsonb
    or c::text like '%challenger_habit%' or c::text like '%opponent_habit%' then
    raise exception 'Measured score or privacy was incorrect';
  end if;
  perform public.social_react_challenge((c->>'id')::uuid,'started','like');
  perform public.social_react_challenge((c->>'id')::uuid,'started','keep_it_up','note');
  select value into c from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance test';
  if c->>'start_reaction' is distinct from 'like' or c->>'start_note' is distinct from 'keep_it_up' then
    raise exception 'Encouragement must coexist with a reaction';
  end if;
end $$;

rollback;
select 'PASS: challenge permissions, ranking, scores, reactions, privacy and result locking.' as result;
