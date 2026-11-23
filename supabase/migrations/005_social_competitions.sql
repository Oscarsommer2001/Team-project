begin;

create table public.social_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.social_profiles(user_id) on delete cascade,
  opponent uuid not null references public.social_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 60),
  metric text not null check (metric in ('days', 'completions')),
  duration integer not null check (duration in (7, 14, 30)),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  starts_on date,
  ends_on date,
  challenger_shares boolean not null default false,
  opponent_shares boolean not null default false,
  final_scores jsonb,
  check (challenger <> opponent)
);
create unique index social_pending_challenge_pair on public.social_challenges
  (least(challenger, opponent), greatest(challenger, opponent)) where status = 'pending';
create index social_challenge_challenger on public.social_challenges (challenger);
create index social_challenge_opponent on public.social_challenges (opponent);

create table public.social_challenge_reactions (
  challenge_id uuid not null references public.social_challenges(id) on delete cascade,
  event text not null check (event in ('started', 'result')),
  sender uuid not null references public.social_profiles(user_id) on delete cascade,
  reaction text not null check (reaction in ('like','cheer','fire')),
  reacted_at timestamptz not null default now(),
  primary key (challenge_id, event, sender)
);

alter table public.social_challenges enable row level security;
alter table public.social_challenge_reactions enable row level security;
revoke all on public.social_challenges, public.social_challenge_reactions from public, anon, authenticated;

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

create function public.social_invite_challenge(handle text, label text, scoring text, days integer, share boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  select user_id into other from public.social_profiles where username = handle;
  if not public.social_are_friends(me, other) then raise exception 'Choose an accepted friend.'; end if;
  insert into public.social_challenges(challenger, opponent, title, metric, duration, challenger_shares)
  values (me, other, btrim(label), scoring, days, coalesce(share, false));
exception when unique_violation then
  raise exception 'You already have a pending challenge with this friend.';
end;
$$;

create function public.social_answer_challenge(challenge uuid, action text, share boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
begin
  if action not in ('accept','decline','cancel','hide') or action is null then raise exception 'Unknown challenge action.'; end if;
  update public.social_challenges c set
    status = case action when 'accept' then 'accepted' when 'decline' then 'declined'
      when 'cancel' then 'cancelled' else c.status end,
    opponent_shares = case when action = 'accept' then c.challenger_shares and coalesce(share, false)
      when action = 'hide' and me = c.opponent then false else c.opponent_shares end,
    challenger_shares = case when action = 'hide' and me = c.challenger then false else c.challenger_shares end,
    accepted_at = case when action = 'accept' then now() else c.accepted_at end,
    starts_on = case when action = 'accept' then today else c.starts_on end,
    ends_on = case when action = 'accept' then today + c.duration - 1 else c.ends_on end
  where c.id = challenge and public.social_are_friends(c.challenger, c.opponent)
    and ((c.status = 'pending' and (
      (c.opponent = me and action in ('accept','decline')) or (c.challenger = me and action = 'cancel')
    )) or (c.status = 'accepted' and action = 'hide' and me in (c.challenger, c.opponent)));
  if not found then raise exception 'This challenge is no longer available for that action.'; end if;
end;
$$;

-- A score contains only totals. Individual habit details still follow per-habit sharing.
create function public.social_challenge_score(person uuid, scoring text, first_day date, last_day date)
returns bigint language sql stable set search_path = '' as $$
  select case when scoring = 'days' then count(distinct d.key) else count(*) end
  from public.habit_accounts a
  cross join lateral jsonb_each(case when jsonb_typeof(a.payload->'logs') = 'object'
    then a.payload->'logs' else '{}'::jsonb end) d
  cross join lateral jsonb_each(case when jsonb_typeof(d.value) = 'object' then d.value else '{}'::jsonb end) log
  where a.user_id = person and log.value->>'status' = 'done'
    and d.key between to_char(first_day, 'YYYY-MM-DD') and to_char(last_day, 'YYYY-MM-DD');
$$;

create function public.social_competitions()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  result jsonb;
begin
  -- Lock completed scores the first time a participant or an authorized friend views them.
  update public.social_challenges c set final_scores = jsonb_build_array(
    public.social_challenge_score(c.challenger, c.metric, c.starts_on, c.ends_on),
    public.social_challenge_score(c.opponent, c.metric, c.starts_on, c.ends_on))
  where c.status = 'accepted' and c.ends_on < today and c.final_scores is null
    and public.social_can_see_challenge(me, c);

  select coalesce(jsonb_agg(to_jsonb(challenge) order by invited_at desc, id), '[]'::jsonb) into result from (
    select c.id, c.title, c.metric, c.duration, c.invited_at, c.accepted_at, c.starts_on, c.ends_on,
      case when c.final_scores is not null then 'finished' else c.status end as status,
      a.username as challenger, b.username as opponent,
      me in (c.challenger, c.opponent) as mine, me = c.opponent as incoming,
      c.challenger_shares as offered_sharing, c.challenger_shares and c.opponent_shares as shared,
      case when c.final_scores is not null then c.final_scores
        when c.status = 'accepted' and me in (c.challenger, c.opponent) then jsonb_build_array(
          public.social_challenge_score(c.challenger, c.metric, c.starts_on, least(today,c.ends_on)),
          public.social_challenge_score(c.opponent, c.metric, c.starts_on, least(today,c.ends_on))) end as scores,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'started' and sender = me) as start_reaction,
      (select reaction from public.social_challenge_reactions
        where challenge_id = c.id and event = 'result' and sender = me) as result_reaction
    from public.social_challenges c
    join public.social_profiles a on a.user_id = c.challenger
    join public.social_profiles b on b.user_id = c.opponent
    where c.status in ('pending', 'accepted', 'declined') and public.social_can_see_challenge(me, c)
    order by c.invited_at desc, c.id
    limit 100
  ) challenge;
  return result;
end;
$$;

create function public.social_react_challenge(challenge uuid, moment text, choice text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.social_challenges c where c.id = challenge and c.status = 'accepted'
      and (moment = 'started' or (moment = 'result' and c.final_scores is not null))
      and public.social_can_see_challenge(me, c)
  ) then raise exception 'This challenge update is unavailable.'; end if;
  if choice is null then
    delete from public.social_challenge_reactions
    where challenge_id = challenge and event = moment and sender = me;
  else
    insert into public.social_challenge_reactions(challenge_id, event, sender, reaction)
    values (challenge, moment, me, choice)
    on conflict (challenge_id, event, sender) do update
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
  public.social_challenge_score(uuid, text, date, date)
from public, anon, authenticated;
revoke all on function public.social_invite_challenge(text, text, text, integer, boolean),
  public.social_answer_challenge(uuid, text, boolean), public.social_competitions(),
  public.social_react_challenge(uuid, text, text), public.social_challenge_alerts(), public.social_week()
from public, anon, authenticated;
grant execute on function public.social_invite_challenge(text, text, text, integer, boolean),
  public.social_answer_challenge(uuid, text, boolean), public.social_competitions(),
  public.social_react_challenge(uuid, text, text), public.social_challenge_alerts(), public.social_week()
to authenticated;

commit;
