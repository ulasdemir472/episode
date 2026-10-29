begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','alice@example.test'),('00000000-0000-4000-8000-000000000002','bob@example.test'),('00000000-0000-4000-8000-000000000003','eve@example.test');
insert into public.friendships(requester_id,addressee_id,status) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','accepted');
insert into public.library_items(user_id,media_type,media_id,status,media) values ('00000000-0000-4000-8000-000000000001','movie',12,'completed','{"id":12,"type":"movie","title":"Movie","genres":[]}');
update public.profiles set visibility = 'friends' where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.test_assert((select count(*) from public.library_items) = 1,'Friends can view a friends-only library');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.test_assert((select count(*) from public.library_items) = 0,'Nonfriends cannot view a friends-only library');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.profiles set visibility = 'private' where id = auth.uid();
select public.test_assert((select count(*) from public.library_items) = 1,'Owner retains private library access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.test_assert((select count(*) from public.library_items) = 0,'Friends cannot view a private library');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_shared_watchlist('Weekend',array['00000000-0000-4000-8000-000000000002'::uuid]) as list_id \gset
set constraints all immediate;
reset role;
select public.test_assert(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-000000000002' and data->>'route' = '/shared-lists' and data->>'kind' = 'list'),'Shared-list invitations open the correct destination');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.watch_wheel_entries(wheel_id,added_by,media) values (:'list_id',auth.uid(),'{"id":12,"type":"movie","title":"Movie","genres":[]}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
update public.watch_wheel_entries set watched = true where wheel_id = :'list_id';
select public.test_assert((select bool_and(watched) from public.watch_wheel_entries where wheel_id = :'list_id'),'Invited member can mark a shared title watched');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.test_assert((select count(*) from public.watch_wheel_entries where wheel_id = :'list_id') = 0,'Nonmember cannot read a shared list');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_watch_wheel('{}') as wheel_id \gset
insert into public.watch_wheel_entries(wheel_id,added_by,media) values (:'wheel_id',auth.uid(),'{"id":12,"type":"movie","title":"One","genres":[]}'),(:'wheel_id',auth.uid(),'{"id":13,"type":"movie","title":"Two","genres":[]}');
select public.spin_watch_wheel(:'wheel_id', null)::text as first_result \gset
select public.test_assert(public.spin_watch_wheel(:'wheel_id', null)::text = :'first_result','Simultaneous spins with the same version share one result');
select public.test_assert(not has_column_privilege('authenticated','public.watch_wheels','result_media','update'),'Clients cannot bypass the server draw');
insert into public.user_blocks(user_id,blocked_user_id) values(auth.uid(),'00000000-0000-4000-8000-000000000002');
select public.test_assert((select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000002') = 0,'Blocked profile is hidden');
reset role;
select public.test_assert((select count(*) from public.friendships) = 0,'Blocking removes friendship');
rollback;
