begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','alice@example.test'),('00000000-0000-4000-8000-000000000002','bob@example.test'),('00000000-0000-4000-8000-000000000003','eve@example.test');
insert into public.library_items(user_id,media_type,media_id,status,media) values ('00000000-0000-4000-8000-000000000001','movie',12,'completed','{"id":12,"type":"movie","title":"Movie","genres":[]}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.comments(id,user_id,target_key,target_type,media_type,media_id,body) values ('00000000-0000-4000-8000-000000000099',auth.uid(),'media:movie:12','media','movie',12,'A comment to like');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
insert into public.comment_likes(comment_id,user_id) values ('00000000-0000-4000-8000-000000000099',auth.uid());
select public.test_assert((select liked_by_me and like_count = 1 from public.comment_like_summary(array['00000000-0000-4000-8000-000000000099'::uuid])),'A like persists and is returned to the current viewer');
insert into public.comment_likes(comment_id,user_id) values ('00000000-0000-4000-8000-000000000099',auth.uid()) on conflict do nothing;
select public.test_assert((select count(*) from public.comment_likes) = 1,'A retried like is idempotent');
delete from public.comment_likes where user_id = auth.uid();
select public.test_assert((select not liked_by_me and like_count = 0 from public.comment_like_summary(array['00000000-0000-4000-8000-000000000099'::uuid])),'Unlike persists');
reset role;
select public.test_assert((select count(*) from public.notifications where type = 'comment_like') = 1,'A like creates one inbox notification without trigger field errors');
insert into public.friendships(requester_id,addressee_id,status) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','accepted');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_shared_watchlist('Solo first', '{}') as list_id \gset
select public.test_assert((select count(*) from public.watch_wheel_members where wheel_id = :'list_id') = 1,'A list can start with only its owner');
select public.invite_shared_watchlist_members(:'list_id', array['00000000-0000-4000-8000-000000000002'::uuid,'00000000-0000-4000-8000-000000000002'::uuid]);
select public.invite_shared_watchlist_members(:'list_id', array['00000000-0000-4000-8000-000000000002'::uuid]);
select public.test_assert((select count(*) from public.watch_wheel_members where wheel_id = :'list_id') = 2,'An existing list accepts a friend later without duplicate membership');
set constraints all immediate;
select set_config('episode.test_list_id', :'list_id', true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform public.invite_shared_watchlist_members(current_setting('episode.test_list_id')::uuid, array['00000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'TEST_NONOWNER_INVITE_ACCEPTED';
  exception when others then if sqlerrm = 'TEST_NONOWNER_INVITE_ACCEPTED' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.invite_shared_watchlist_members(current_setting('episode.test_list_id')::uuid, array['00000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'TEST_NONFRIEND_INVITE_ACCEPTED';
  exception when others then if sqlerrm = 'TEST_NONFRIEND_INVITE_ACCEPTED' then raise; end if; end;
end $$;
reset role;
select public.test_assert((select count(*) from public.notifications where type = 'watch_wheel_invite' and user_id = '00000000-0000-4000-8000-000000000002') = 1,'Later invitation produces one notification');
rollback;
