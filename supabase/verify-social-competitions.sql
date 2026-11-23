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

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
do $$ begin
  begin
    perform public.social_invite_challenge('challenge_b','Invalid target','days',7,false,null,5);
    raise sqlstate 'P0002' using message = 'Unmeasured shared goal accepted';
  exception when raise_exception then null;
  end;
  begin
    perform public.social_invite_challenge('challenge_b','Invalid amount','amount',7,false,'run',0);
    raise sqlstate 'P0002' using message = 'Zero shared target accepted';
  exception when raise_exception then null;
  end;
end $$;
select public.social_invite_challenge('challenge_b','Distance together','amount',7,true,'run',6);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance together');
begin
  if c->>'goal_target' is distinct from '6' or c->>'scores' is not null then
    raise exception 'Pending shared goal leaked scores or lost its target';
  end if;
  perform public.social_answer_challenge((c->>'id')::uuid,'accept',true,'run');
  select value into c from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance together';
  if c->>'status' is distinct from 'accepted' or c->'scores' is distinct from '[2.5,2.5]'::jsonb then
    raise exception 'Shared goal must show both contributions before it is reached';
  end if;
end $$;
update public.habit_accounts set payload = jsonb_set(payload, array['logs',to_char(current_date, 'YYYY-MM-DD'),'run','value'],'4')
where user_id = '00000000-0000-4000-8000-000000000302';
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance together');
begin
  if c->>'status' is distinct from 'accepted' or c->>'scores' is not null then
    raise exception 'Mutual friends cannot lock or see unfinished shared goal totals';
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance together');
begin
  if c->>'status' is distinct from 'finished' or c->'scores' is distinct from '[2.5,4]'::jsonb
    or c->>'goal_reached_at' is null then raise exception 'Shared goal did not lock combined contributions'; end if;
  perform public.social_react_challenge((c->>'id')::uuid,'result','cheer');
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
update public.habit_accounts set payload = '{}' where user_id = '00000000-0000-4000-8000-000000000302';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Distance together');
begin
  if c->'scores' is distinct from '[2.5,4]'::jsonb
    or not exists (select 1 from jsonb_array_elements(public.social_challenge_alerts())
      where value->>'title' = 'Distance together' and value->>'reaction' = 'cheer') then
    raise exception 'Shared result was not saved or could not receive encouragement';
  end if;
end $$;

-- Invites can be corrected safely, and participants can stop active activities without scoring a winner.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
select public.social_invite_challenge('challenge_b','Edit this invite','amount',7,false,'run');
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Edit this invite');
begin
  perform public.social_edit_challenge((c->>'id')::uuid,(c->>'edit_version')::integer,'Read pages together',14,null,'read');
  if jsonb_array_length(public.social_activity_changes()) <> 0 then raise exception 'Actor saw their own changes'; end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Read pages together');
begin
  if c->>'unit' is distinct from 'pages' or c->>'duration' is distinct from '14'
    or public.social_activity_changes()->0->'details'->'unit' is distinct from '["km","pages"]'::jsonb then
    raise exception 'Invite changes were not visible to its recipient';
  end if;
  begin
    perform public.social_answer_challenge((c->>'id')::uuid,'accept',false,'read',1);
    raise sqlstate 'P0002' using message = 'Stale invite accepted';
  exception when raise_exception then null;
  end;
end $$;
reset role;
update public.habit_accounts
set payload = '{"goals":[{"id":"read","name":"Read","unit":"pages"}],"logs":{}}'
where user_id = '00000000-0000-4000-8000-000000000302';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Read pages together');
begin
  perform public.social_answer_challenge((c->>'id')::uuid,'accept',false,'read',(c->>'edit_version')::integer);
  select value into c from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Read pages together';
  begin
    perform public.social_edit_challenge((c->>'id')::uuid,(c->>'edit_version')::integer,'Read more',30,null,'read');
    raise sqlstate 'P0002' using message = 'Active tracker replacement allowed';
  exception when raise_exception then null;
  end;
  perform public.social_edit_challenge((c->>'id')::uuid,(c->>'edit_version')::integer,'Read more',30);
  select value into c from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Read more';
  if c->>'ends_on' is distinct from to_char(current_date+29,'YYYY-MM-DD') then raise exception 'Deadline edit incorrect'; end if;
  perform public.social_answer_challenge((c->>'id')::uuid,'stop',false,null,(c->>'edit_version')::integer);
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
do $$
declare c jsonb := (select value from jsonb_array_elements(public.social_competitions()) where value->>'title' = 'Read more');
begin
  if c->>'status' is distinct from 'stopped' or c->>'scores' is not null
    or public.social_activity_changes()->0->>'action' is distinct from 'stopped'
    or public.social_activity_changes()->1->'details'->'duration' is distinct from '[14,30]'::jsonb then
    raise exception 'Editing and stopping must notify the other participant without producing a score';
  end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
do $$ begin
  if jsonb_array_length(public.social_activity_changes()) <> 0
    or has_table_privilege('authenticated','public.social_challenge_changes','SELECT')
    or has_function_privilege('anon','public.social_activity_changes()','EXECUTE') then
    raise exception 'Activity changes exposed outside the participants';
  end if;
end $$;

rollback;
select 'PASS: challenge permissions, rankings, measured scores, shared goals, editing, stopping and notifications.' as result;
