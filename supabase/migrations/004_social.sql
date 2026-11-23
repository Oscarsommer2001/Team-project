begin;

create table public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  shared_habits text[] not null default '{}'
);

create table public.social_friendships (
  requester uuid not null references public.social_profiles(user_id) on delete cascade,
  recipient uuid not null references public.social_profiles(user_id) on delete cascade,
  accepted boolean not null default false,
  check (requester <> recipient)
);
create unique index social_friendship_pair
  on public.social_friendships (least(requester, recipient), greatest(requester, recipient));
create index social_friendship_requester on public.social_friendships (requester);
create index social_friendship_recipient on public.social_friendships (recipient);

create table public.social_cheers (
  sender uuid not null references public.social_profiles(user_id) on delete cascade,
  owner uuid not null references public.social_profiles(user_id) on delete cascade,
  habit_id text not null,
  day text not null,
  primary key (sender, owner, habit_id, day)
);

alter table public.social_profiles enable row level security;
alter table public.social_friendships enable row level security;
alter table public.social_cheers enable row level security;
revoke all on public.social_profiles, public.social_friendships, public.social_cheers
  from public, anon, authenticated;

create function public.social_save_profile(handle text, habit_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to use Friends.'; end if;
  if handle is null or handle !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Use 3–20 lowercase letters, numbers or underscores.';
  end if;
  if habit_ids is null or exists (
    select 1 from unnest(habit_ids) as requested(id)
    where not exists (
      select 1 from public.habit_accounts a
      cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'goals') = 'array'
        then a.payload->'goals' else '[]'::jsonb end) g
      where a.user_id = me and g->>'id' = requested.id
        and coalesce(g->>'archived', 'false') <> 'true'
    )
  ) then raise exception 'Some habits are no longer available. Refresh and try again.'; end if;
  insert into public.social_profiles(user_id, username, shared_habits)
  values (me, handle, habit_ids)
  on conflict (user_id) do update
  set username = excluded.username, shared_habits = excluded.shared_habits;
exception when unique_violation then
  raise exception 'That username is already taken.';
end;
$$;

create function public.social_network()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('username', username, 'sharedHabits', shared_habits)
      from public.social_profiles where user_id = auth.uid()),
    'connections', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'status',
        case when f.accepted then 'friend' when f.recipient = auth.uid() then 'incoming'
          else 'outgoing' end) order by p.username)
      from public.social_friendships f
      join public.social_profiles p on p.user_id =
        case when f.requester = auth.uid() then f.recipient else f.requester end
      where auth.uid() in (f.requester, f.recipient)
    ), '[]'::jsonb)
  );
$$;

create function public.social_find(handle text)
returns text language sql stable security definer set search_path = '' as $$
  select username from public.social_profiles
  where username = handle and user_id <> auth.uid()
    and exists (select 1 from public.social_profiles where user_id = auth.uid());
$$;

create function public.social_connect(handle text, action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  select user_id into other from public.social_profiles where username = handle;
  if me is null or other is null or me = other
    or not exists (select 1 from public.social_profiles where user_id = me) then
    raise exception 'This user is unavailable.';
  end if;
  case action
    when 'send' then
      insert into public.social_friendships(requester, recipient) values (me, other)
        on conflict do nothing;
    when 'accept' then
      update public.social_friendships set accepted = true
        where requester = other and recipient = me and not accepted;
    when 'decline' then
      delete from public.social_friendships
        where requester = other and recipient = me and not accepted;
    when 'cancel' then
      delete from public.social_friendships
        where requester = me and recipient = other and not accepted;
    when 'remove' then
      delete from public.social_friendships where accepted and
        ((requester = me and recipient = other) or (requester = other and recipient = me));
    else raise exception 'Unknown friend action.';
  end case;
end;
$$;

-- Internal projection. Only friends' explicitly selected habits are included.
-- Never return the account payload, coach settings, email, or log values.
create function public.social_shared_goals(viewer uuid)
returns table (owner uuid, username text, goal jsonb, logs jsonb)
language sql stable set search_path = '' as $$
  select p.user_id, p.username, g, case when jsonb_typeof(a.payload->'logs') = 'object'
    then a.payload->'logs' else '{}'::jsonb end
  from public.social_friendships f
  join public.social_profiles p on p.user_id =
    case when f.requester = viewer then f.recipient else f.requester end
  join public.habit_accounts a on a.user_id = p.user_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'goals') = 'array'
    then a.payload->'goals' else '[]'::jsonb end) g
  where f.accepted and viewer in (f.requester, f.recipient)
    and g->>'id' = any(p.shared_habits) and coalesce(g->>'archived', 'false') <> 'true';
$$;

create function public.social_activity()
returns jsonb language sql stable security definer set search_path = '' as $$
  with shared as materialized (select * from public.social_shared_goals(auth.uid())),
  completions as (
    select s.owner, s.username, s.goal->>'id' as id, s.goal->>'name' as name, l.key as day
    from shared s cross join lateral jsonb_each(s.logs) l
    where l.value->(s.goal->>'id')->>'status' = 'done'
    order by l.key desc, s.username, s.goal->>'id'
    limit 30
  )
  select jsonb_build_object(
    'habits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', s.username, 'name', s.goal->'name', 'category', s.goal->'category', 'detail', s.goal->'detail',
        'target', s.goal->'target', 'unit', s.goal->'unit', 'days', s.goal->'days',
        'completed', stats.completed, 'streak', stats.streak
      ) order by s.username, s.goal->>'name')
      from shared s
      cross join lateral (
        select count(*) filter (where status = 'done') as completed,
          count(*) filter (where status = 'done' and (last_miss is null or day > last_miss)) as streak
        from (
          select l.key as day, r.status,
            max(l.key) filter (where r.status <> 'done' and l.key < to_char(current_date, 'YYYY-MM-DD')) over () as last_miss
          from jsonb_each(s.logs) l
          cross join lateral (select l.value->(s.goal->>'id')->>'status' as status) r
          where r.status is not null and l.key <= to_char(current_date + 1, 'YYYY-MM-DD')
        ) days
      ) stats
    ), '[]'::jsonb),
    'feed', coalesce((
      select jsonb_agg(jsonb_build_object('username', c.username, 'id', c.id,
        'name', c.name, 'day', c.day, 'cheered', e.sender is not null)
        order by c.day desc, c.username, c.id)
      from completions c
      left join public.social_cheers e on e.sender = auth.uid() and e.owner = c.owner
        and e.habit_id = c.id and e.day = c.day
    ), '[]'::jsonb),
    'received', coalesce((
      select jsonb_agg(to_jsonb(recent) order by recent.day desc, recent.username, recent.name)
      from (
        select sender.username, g->>'name' as name, e.day
        from public.social_cheers e
        join public.social_profiles owner on owner.user_id = e.owner
        join public.social_profiles sender on sender.user_id = e.sender
        join public.habit_accounts a on a.user_id = e.owner
        cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'goals') = 'array'
          then a.payload->'goals' else '[]'::jsonb end) g
        where e.owner = auth.uid() and g->>'id' = e.habit_id
          and e.habit_id = any(owner.shared_habits) and coalesce(g->>'archived', 'false') <> 'true'
          and a.payload->'logs'->e.day->e.habit_id->>'status' = 'done'
          and exists (
            select 1 from public.social_friendships f where f.accepted
              and least(f.requester, f.recipient) = least(e.sender, e.owner)
              and greatest(f.requester, f.recipient) = greatest(e.sender, e.owner)
          )
        order by e.day desc, sender.username, e.habit_id
        limit 30
      ) recent
    ), '[]'::jsonb)
  );
$$;

create function public.social_cheer(handle text, habit text, completed_on text, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  friend_id uuid;
begin
  select s.owner into friend_id from public.social_shared_goals(me) s
  where s.username = handle and s.goal->>'id' = habit
    and s.logs->completed_on->habit->>'status' = 'done';
  if friend_id is null then raise exception 'This completion is no longer shared.'; end if;
  if enabled then
    insert into public.social_cheers(sender, owner, habit_id, day)
      values (me, friend_id, habit, completed_on) on conflict do nothing;
  else
    delete from public.social_cheers
      where sender = me and owner = friend_id and habit_id = habit and day = completed_on;
  end if;
end;
$$;

revoke all on function public.social_shared_goals(uuid) from public, anon, authenticated;
revoke all on function public.social_save_profile(text, text[]), public.social_network(),
  public.social_find(text), public.social_connect(text, text), public.social_activity(),
  public.social_cheer(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.social_save_profile(text, text[]), public.social_network(),
  public.social_find(text), public.social_connect(text, text), public.social_activity(),
  public.social_cheer(text, text, text, boolean) to authenticated;

commit;
