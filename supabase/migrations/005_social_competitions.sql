begin;

create table public.social_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.social_profiles(user_id) on delete cascade,
  opponent uuid not null references public.social_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 60),
  metric text not null check (metric in ('days', 'completions', 'amount')),
  goal_target numeric,
  goal_reached_at timestamptz,
  unit text,
  challenger_habit text,
  opponent_habit text,
  duration integer not null check (duration in (7, 14, 30)),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'stopped')),
  edit_version integer not null default 1,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  responded_at timestamptz,
  starts_on date,
  ends_on date,
  challenger_shares boolean not null default false,
  opponent_shares boolean not null default false,
  final_scores jsonb,
  check (challenger <> opponent),
  check (goal_target is null or (metric = 'amount' and goal_target between 0.01 and 1000000
    and goal_target = round(goal_target, 2)))
);
create unique index social_pending_challenge_pair on public.social_challenges
  (least(challenger, opponent), greatest(challenger, opponent), (goal_target is not null)) where status = 'pending';
create index social_challenge_challenger on public.social_challenges (challenger);
create index social_challenge_opponent on public.social_challenges (opponent);

create table public.social_challenge_reactions (
  challenge_id uuid not null references public.social_challenges(id) on delete cascade,
  event text not null check (event in ('started', 'result')),
  sender uuid not null references public.social_profiles(user_id) on delete cascade,
  reaction text not null check (reaction in ('like','cheer','fire','keep_it_up','great_work')),
  kind text generated always as (case when reaction in ('keep_it_up','great_work') then 'note' else 'reaction' end) stored,
  reacted_at timestamptz not null default now(),
  primary key (challenge_id, event, sender, kind)
);

create table public.social_challenge_changes (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.social_challenges(id) on delete cascade,
  actor uuid not null references public.social_profiles(user_id) on delete cascade,
  action text not null check (action in ('edited','stopped','cancelled','hid')),
  title text not null,
  details jsonb not null default '{}',
  changed_at timestamptz not null default now()
);
create index social_challenge_changes_activity on public.social_challenge_changes (challenge_id, changed_at desc);

alter table public.social_challenges enable row level security;
alter table public.social_challenge_reactions enable row level security;
alter table public.social_challenge_changes enable row level security;
revoke all on public.social_challenges, public.social_challenge_reactions, public.social_challenge_changes
  from public, anon, authenticated;

create function public.social_are_friends(first_id uuid, second_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.social_friendships f where f.accepted
      and least(f.requester, f.recipient) = least(first_id, second_id)
      and greatest(f.requester, f.recipient) = greatest(first_id, second_id)
      and first_id is not null and second_id is not null and first_id <> second_id
  );
$$;

create function public.social_can_see_challenge(me uuid, c public.social_challenges)
returns boolean language sql stable set search_path = '' as $$
  select public.social_are_friends(c.challenger, c.opponent) and (
    me in (c.challenger, c.opponent) or (
      c.status = 'accepted' and c.challenger_shares and c.opponent_shares
      and public.social_are_friends(me, c.challenger) and public.social_are_friends(me, c.opponent)
    )
  );
$$;

create function public.social_measure_unit(value text)
returns text language sql immutable set search_path = '' as $$
  select case lower(btrim(value))
    when 'kilometer' then 'km' when 'kilometers' then 'km'
    when 'kilometre' then 'km' when 'kilometres' then 'km'
    when 'minute' then 'minutes' when 'min' then 'minutes'
    when 'page' then 'pages'
    else nullif(lower(btrim(value)), '') end;
$$;

create function public.social_habit_unit(person uuid, habit text)
returns text language sql stable set search_path = '' as $$
  select public.social_measure_unit(g->>'unit')
  from public.habit_accounts a
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'goals') = 'array'
    then a.payload->'goals' else '[]'::jsonb end) g
  where a.user_id = person and g->>'id' = habit and coalesce(g->>'archived', 'false') <> 'true'
  limit 1;
$$;

create function public.social_invite_challenge(handle text, label text, scoring text, days integer,
  share boolean, habit text default null, target numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  units text;
begin
  select user_id into other from public.social_profiles where username = handle;
  if not public.social_are_friends(me, other) then raise exception 'Choose an accepted friend.'; end if;
  if target is not null and (scoring is distinct from 'amount' or target not between 0.01 and 1000000 or target <> round(target, 2)) then
    raise exception 'Shared goals require a target between 0.01 and 1,000,000 with up to two decimals.';
  end if;
  if scoring = 'amount' then
    units := public.social_habit_unit(me, habit);
    if units is null or char_length(units) > 20 then raise exception 'Choose an active habit with a measurement unit.'; end if;
  end if;
  insert into public.social_challenges(challenger, opponent, title, metric, duration, challenger_shares, unit, goal_target, challenger_habit)
  values (me, other, btrim(label), scoring, days, coalesce(share, false), units, target,
    case when scoring = 'amount' then habit end);
exception when unique_violation then
  raise exception 'You already have a pending invite of this kind with this friend.';
end;
$$;

create function public.social_edit_challenge(challenge uuid, expected integer, label text, days integer,
  target numeric default null, replacement_habit text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  entry public.social_challenges;
  units text;
  changes jsonb := '{}';
begin
  select c.* into entry from public.social_challenges c
    where c.id = challenge and c.edit_version = expected and c.final_scores is null
      and public.social_are_friends(c.challenger, c.opponent)
      and ((c.status = 'pending' and me = c.challenger)
        or (c.status = 'accepted' and c.ends_on >= today and me in (c.challenger, c.opponent)))
    for update;
  if not found then raise exception 'This activity changed or can no longer be edited. Refresh Friends and try again.'; end if;
  if label is null or char_length(btrim(label)) not between 3 and 60 then
    raise exception 'Enter a name between 3 and 60 characters.';
  end if;
  if days is null or days not in (7,14,30) then raise exception 'Choose 7, 14 or 30 days.'; end if;
  if entry.starts_on + days - 1 < today then raise exception 'That duration would end in the past. Stop the activity to end it now.'; end if;
  if (entry.goal_target is null) <> (target is null) or
    (target is not null and (target not between 0.01 and 1000000 or target <> round(target, 2))) then
    raise exception 'A shared goal needs a target between 0.01 and 1,000,000 with up to two decimals.';
  end if;
  units := entry.unit;
  if replacement_habit is not null then
    if entry.status <> 'pending' or entry.metric <> 'amount' then
      raise exception 'The unit and linked habit are fixed after an activity starts.';
    end if;
    units := public.social_habit_unit(me, replacement_habit);
    if units is null or char_length(units) > 20 then raise exception 'Choose an active habit with a measurement unit.'; end if;
  end if;
  if entry.title <> btrim(label) then changes := changes || jsonb_build_object('name', jsonb_build_array(entry.title,btrim(label))); end if;
  if entry.duration <> days then changes := changes || jsonb_build_object('duration', jsonb_build_array(entry.duration,days)); end if;
  if entry.goal_target is distinct from target then changes := changes || jsonb_build_object('target', jsonb_build_array(entry.goal_target,target)); end if;
  if entry.unit is distinct from units then changes := changes || jsonb_build_object('unit', jsonb_build_array(entry.unit,units)); end if;
  if replacement_habit is not null and replacement_habit <> entry.challenger_habit and entry.unit = units then
    changes := changes || '{"tracker":true}'::jsonb;
  end if;
  if changes = '{}' then return; end if;

  update public.social_challenges set title = btrim(label), duration = days, goal_target = target,
    unit = units, challenger_habit = coalesce(replacement_habit, entry.challenger_habit),
    ends_on = entry.starts_on + days - 1, edit_version = entry.edit_version + 1
  where id = challenge;
  insert into public.social_challenge_changes(challenge_id,actor,action,title,details)
  values (challenge,me,'edited',btrim(label),changes);
end;
$$;

create function public.social_answer_challenge(challenge uuid, action text, share boolean default false,
  habit text default null, expected integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  units text;
  entry public.social_challenges;
begin
  if action not in ('accept','decline','cancel','hide','stop') or action is null then raise exception 'Unknown challenge action.'; end if;
  -- Keep the invite stable between validating its unit and accepting the terms.
  select c.* into entry from public.social_challenges c where c.id = challenge and me in (c.challenger,c.opponent)
    and (expected is null or c.edit_version = expected) and public.social_are_friends(c.challenger,c.opponent)
    for update;
  if not found then raise exception 'This activity changed or is no longer available. Refresh Friends and try again.'; end if;
  if action = 'accept' then
    units := entry.unit;
    if units is not null and public.social_habit_unit(me, habit) is distinct from units then
      raise exception 'Choose one of your active habits measured in %.', units;
    end if;
  end if;
  update public.social_challenges c set
    status = case action when 'accept' then 'accepted' when 'decline' then 'declined'
      when 'cancel' then 'cancelled' when 'stop' then 'stopped' else c.status end,
    edit_version = c.edit_version + 1,
    opponent_shares = case when action = 'accept' then c.challenger_shares and coalesce(share, false)
      when action = 'hide' and me = c.opponent then false else c.opponent_shares end,
    challenger_shares = case when action = 'hide' and me = c.challenger then false else c.challenger_shares end,
    accepted_at = case when action = 'accept' then now() else c.accepted_at end,
    responded_at = case when action in ('accept','decline') then now() else c.responded_at end,
    opponent_habit = case when action = 'accept' and c.metric = 'amount' then habit else c.opponent_habit end,
    starts_on = case when action = 'accept' then today else c.starts_on end,
    ends_on = case when action = 'accept' then today + c.duration - 1 else c.ends_on end
  where c.id = challenge
    and ((c.status = 'pending' and (
      (c.opponent = me and action in ('accept','decline')) or (c.challenger = me and action = 'cancel')
    )) or (c.status = 'accepted' and (
      (action = 'hide' and c.challenger_shares and c.opponent_shares)
      or (action = 'stop' and c.final_scores is null and c.ends_on >= today)
    )));
  if not found then raise exception 'This challenge is no longer available for that action.'; end if;
  if action in ('cancel','hide','stop') then
    insert into public.social_challenge_changes(challenge_id,actor,action,title)
    values (challenge,me,case action when 'cancel' then 'cancelled' when 'stop' then 'stopped' else 'hid' end,entry.title);
  end if;
end;
$$;

-- A score contains only totals. Individual habit details still follow per-habit sharing.
create function public.social_challenge_score(person uuid, scoring text, first_day date, last_day date,
  habit text, units text)
returns numeric language sql stable set search_path = '' as $$
  select case when scoring = 'days' then count(distinct d.key)
    when scoring = 'amount' then coalesce(sum(case when jsonb_typeof(log.value->'value') = 'number'
      then greatest(0, least(100000, (log.value->>'value')::numeric)) else 0 end), 0)
    else count(*) end
  from public.habit_accounts a
  cross join lateral jsonb_each(case when jsonb_typeof(a.payload->'logs') = 'object'
    then a.payload->'logs' else '{}'::jsonb end) d
  cross join lateral jsonb_each(case when jsonb_typeof(d.value) = 'object' then d.value else '{}'::jsonb end) log
  where a.user_id = person
    and (case when scoring = 'amount' then log.key = habit and public.social_measure_unit(log.value->>'unit') = units
      else log.value->>'status' = 'done' end)
    and d.key between to_char(first_day, 'YYYY-MM-DD') and to_char(last_day, 'YYYY-MM-DD');
$$;

create function public.social_competitions()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  result jsonb;
begin
  -- Save the result once, at the deadline or at the first participant view that reaches the shared target.
  with eligible as materialized (
    select c.id, c.edit_version, c.ends_on, c.goal_target,
      public.social_challenge_score(c.challenger, c.metric, c.starts_on, least(today,c.ends_on), c.challenger_habit, c.unit) as first_score,
      public.social_challenge_score(c.opponent, c.metric, c.starts_on, least(today,c.ends_on), c.opponent_habit, c.unit) as second_score
    from public.social_challenges c
    where c.status = 'accepted' and c.final_scores is null and public.social_can_see_challenge(me, c)
      and (c.ends_on < today or (c.goal_target is not null and me in (c.challenger, c.opponent)))
  )
  update public.social_challenges c set
    final_scores = jsonb_build_array(e.first_score, e.second_score),
    goal_reached_at = case when e.first_score + e.second_score >= e.goal_target then
      case when e.ends_on < today then (e.ends_on + 1)::timestamp at time zone 'UTC' else now() end
    end
  from eligible e where c.id = e.id and c.status = 'accepted' and c.final_scores is null and c.edit_version = e.edit_version
    and (e.ends_on < today or e.first_score + e.second_score >= e.goal_target);

  select coalesce(jsonb_agg(to_jsonb(challenge) order by invited_at desc, id), '[]'::jsonb) into result from (
    select c.id, c.title, c.metric, c.unit, c.goal_target, c.goal_reached_at, c.duration, c.edit_version,
      c.invited_at, c.accepted_at, c.responded_at, c.starts_on, c.ends_on,
      case when c.final_scores is not null then 'finished' else c.status end as status,
      a.username as challenger, b.username as opponent,
      me in (c.challenger, c.opponent) as mine, me = c.opponent as incoming,
      c.challenger_shares as offered_sharing, c.challenger_shares and c.opponent_shares as shared,
      case when c.final_scores is not null then c.final_scores
        when c.status = 'accepted' and me in (c.challenger, c.opponent) then jsonb_build_array(
          public.social_challenge_score(c.challenger, c.metric, c.starts_on, least(today,c.ends_on), c.challenger_habit, c.unit),
          public.social_challenge_score(c.opponent, c.metric, c.starts_on, least(today,c.ends_on), c.opponent_habit, c.unit)) end as scores,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'started' and sender = me and kind = 'reaction') as start_reaction,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'started' and sender = me and kind = 'note') as start_note,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'result' and sender = me and kind = 'reaction') as result_reaction,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'result' and sender = me and kind = 'note') as result_note
    from public.social_challenges c
    join public.social_profiles a on a.user_id = c.challenger
    join public.social_profiles b on b.user_id = c.opponent
    where c.status in ('pending', 'accepted', 'declined', 'stopped') and public.social_can_see_challenge(me, c)
    order by c.invited_at desc, c.id
    limit 100
  ) challenge;
  return result;
end;
$$;

create function public.social_react_challenge(challenge uuid, moment text, choice text, channel text default 'reaction')
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if channel is null or channel not in ('reaction','note') or
    (choice is not null and (choice in ('keep_it_up','great_work')) <> (channel = 'note')) then
    raise exception 'Choose a supported reaction or encouragement.';
  end if;
  if not exists (
    select 1 from public.social_challenges c where c.id = challenge and c.status = 'accepted'
      and (moment = 'started' or (moment = 'result' and c.final_scores is not null))
      and public.social_can_see_challenge(me, c)
  ) then raise exception 'This challenge update is unavailable.'; end if;
  if choice is null then
    delete from public.social_challenge_reactions
    where challenge_id = challenge and event = moment and sender = me and kind = channel;
  else
    insert into public.social_challenge_reactions(challenge_id, event, sender, reaction)
    values (challenge, moment, me, choice)
    on conflict (challenge_id, event, sender, kind) do update
      set reaction = excluded.reaction, reacted_at = now()
      where public.social_challenge_reactions.reaction <> excluded.reaction;
  end if;
end;
$$;

create function public.social_challenge_alerts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(notice) order by reacted_at desc), '[]'::jsonb) from (
    select c.title, r.event, r.reaction, r.reacted_at, p.username
    from public.social_challenge_reactions r
    join public.social_challenges c on c.id = r.challenge_id
    join public.social_profiles p on p.user_id = r.sender
    where auth.uid() in (c.challenger,c.opponent) and auth.uid() <> r.sender
      and public.social_can_see_challenge(auth.uid(), c)
      and public.social_can_see_challenge(r.sender, c)
    order by r.reacted_at desc
    limit 30
  ) notice;
$$;

create function public.social_activity_changes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(notice) - 'id' order by changed_at desc, id desc), '[]'::jsonb) from (
    select e.id, e.action, e.title, e.details, e.changed_at, p.username
    from public.social_challenge_changes e
    join public.social_challenges c on c.id = e.challenge_id
    join public.social_profiles p on p.user_id = e.actor
    where auth.uid() in (c.challenger,c.opponent) and auth.uid() <> e.actor
      and public.social_are_friends(c.challenger,c.opponent)
    order by e.changed_at desc, e.id desc
    limit 100
  ) notice;
$$;

create function public.social_week()
returns jsonb language sql stable security definer set search_path = '' as $$
  with dates as (
    select distinct s.username, l.key as day
    from public.social_shared_goals(auth.uid()) s cross join lateral jsonb_each(s.logs) l
    where l.value->(s.goal->>'id')->>'status' = 'done'
      and l.key between to_char(current_date - 29, 'YYYY-MM-DD') and to_char(current_date, 'YYYY-MM-DD')
  ), mine as (
    select distinct l.key as day
    from public.social_profiles p join public.habit_accounts a on a.user_id = p.user_id
    cross join lateral jsonb_each(case when jsonb_typeof(a.payload->'logs') = 'object'
      then a.payload->'logs' else '{}'::jsonb end) l
    cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'goals') = 'array'
      then a.payload->'goals' else '[]'::jsonb end) g
    where p.user_id = auth.uid() and g->>'id' = any(p.shared_habits)
      and coalesce(g->>'archived', 'false') <> 'true' and l.value->(g->>'id')->>'status' = 'done'
      and l.key between to_char(current_date - 29, 'YYYY-MM-DD') and to_char(current_date, 'YYYY-MM-DD')
  ), people as (
    select username, count(*) filter (where day >= to_char(current_date - 6, 'YYYY-MM-DD')) as score,
      coalesce(jsonb_agg(day order by day desc) filter (where mine.day is not null), '[]'::jsonb) as together
    from dates left join mine using(day) group by username
    union all
    select p.username, count(*) filter (where mine.day >= to_char(current_date - 6, 'YYYY-MM-DD')), '[]'::jsonb
    from public.social_profiles p cross join mine
    where p.user_id = auth.uid() group by p.username
  )
  select jsonb_build_object('today', current_date, 'rankings',
    coalesce(jsonb_agg(to_jsonb(people) order by score desc, username), '[]'::jsonb)) from people;
$$;

revoke all on function public.social_are_friends(uuid, uuid),
  public.social_can_see_challenge(uuid, public.social_challenges),
  public.social_challenge_score(uuid, text, date, date, text, text), public.social_habit_unit(uuid, text)
from public, anon, authenticated;
revoke all on function public.social_invite_challenge(text, text, text, integer, boolean, text, numeric),
  public.social_answer_challenge(uuid, text, boolean, text, integer), public.social_competitions(),
  public.social_edit_challenge(uuid, integer, text, integer, numeric, text), public.social_activity_changes(),
  public.social_react_challenge(uuid, text, text, text), public.social_challenge_alerts(), public.social_week()
from public, anon, authenticated;
grant execute on function public.social_invite_challenge(text, text, text, integer, boolean, text, numeric),
  public.social_answer_challenge(uuid, text, boolean, text, integer), public.social_competitions(),
  public.social_edit_challenge(uuid, integer, text, integer, numeric, text), public.social_activity_changes(),
  public.social_react_challenge(uuid, text, text, text), public.social_challenge_alerts(), public.social_week()
to authenticated;

commit;
