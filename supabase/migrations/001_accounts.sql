-- One private document per account; Supabase Auth owns identities and passwords.
begin;
create table public.habit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint valid_payload check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2000000))
);
alter table public.habit_accounts enable row level security;
revoke all on public.habit_accounts from anon, authenticated;
grant select, insert, update on public.habit_accounts to authenticated;
create policy "Read your own habits" on public.habit_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create your own habits" on public.habit_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update your own habits" on public.habit_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.bump_habit_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger habit_revision before update on public.habit_accounts
for each row execute function public.bump_habit_revision();
commit;
