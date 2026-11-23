begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000101'), ('00000000-0000-4000-8000-000000000102');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
insert into public.habit_accounts(user_id,payload) values ('00000000-0000-4000-8000-000000000101','{}');
update public.habit_accounts set payload='{"test":true}' where user_id='00000000-0000-4000-8000-000000000101' and revision=1;
do $$ begin
 if not exists(select 1 from public.habit_accounts where revision=2) then raise exception 'Owner update failed'; end if;
 begin
  insert into public.habit_accounts(user_id) values ('00000000-0000-4000-8000-000000000102');
  raise exception 'Cross-user insert was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
do $$ begin
 if exists(select 1 from public.habit_accounts) then raise exception 'Cross-user read allowed'; end if;
 update public.habit_accounts set payload='{}' where user_id='00000000-0000-4000-8000-000000000101';
 if found then raise exception 'Cross-user update allowed'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.habit_accounts','SELECT') then raise exception 'Anonymous access allowed'; end if;
end $$;
rollback;
select 'PASS: own read/write, version increment, cross-user isolation, no anonymous access. Test users rolled back.' as result;