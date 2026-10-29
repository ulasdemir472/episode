begin;
alter table public.profiles add column visibility text not null default 'members' check (visibility in ('private','friends','members'));
create table public.user_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);
alter table public.user_blocks enable row level security;
create policy blocks_own on public.user_blocks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create function public.users_blocked(first_user uuid, second_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where (user_id = first_user and blocked_user_id = second_user) or (user_id = second_user and blocked_user_id = first_user));
$$;
create function public.can_view_profile_data(owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() = owner_id or (auth.uid() is not null and not public.users_blocked(auth.uid(), owner_id) and exists (
    select 1 from public.profiles p where p.id = owner_id and (p.visibility = 'members' or (p.visibility = 'friends' and public.are_friends(auth.uid(), owner_id)))
  ));
$$;
drop policy if exists library_members_read on public.library_items;
drop policy if exists progress_members_read on public.episode_progress;
drop policy if exists favorites_members_read on public.favorites;
create policy library_visibility_read on public.library_items for select to authenticated using (public.can_view_profile_data(user_id));
create policy progress_visibility_read on public.episode_progress for select to authenticated using (public.can_view_profile_data(user_id));
create policy favorites_visibility_read on public.favorites for select to authenticated using (public.can_view_profile_data(user_id));
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (not public.users_blocked(auth.uid(), id));
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select to authenticated using (true);
drop policy if exists comments_read_visible on public.comments;
create policy comments_read_visible on public.comments for select to authenticated using (deleted_at is null and moderation_status = 'visible' and not public.users_blocked(auth.uid(), user_id));
create policy friendships_not_blocked on public.friendships as restrictive for all to authenticated using (not public.users_blocked(requester_id, addressee_id)) with check (not public.users_blocked(requester_id, addressee_id));
create function public.on_user_block() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships where (requester_id = new.user_id and addressee_id = new.blocked_user_id) or (requester_id = new.blocked_user_id and addressee_id = new.user_id);
  delete from public.notifications where user_id = new.user_id and actor_id = new.blocked_user_id;
  return new;
end $$;
create trigger user_block_cleanup after insert on public.user_blocks for each row execute function public.on_user_block();
create function public.suppress_blocked_notification() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is not null and public.users_blocked(new.user_id, new.actor_id) then return null; end if;
  return new;
end $$;
create trigger notifications_block_check before insert on public.notifications for each row execute function public.suppress_blocked_notification();

-- Shared watchlists reuse the existing membership and entry authorization model.
alter table public.watch_wheels add column kind text not null default 'wheel' check (kind in ('wheel','list'));
alter table public.watch_wheel_entries add column watched boolean not null default false;
create policy shared_entries_update on public.watch_wheel_entries for update to authenticated using (public.is_watch_wheel_member(wheel_id, auth.uid()) and exists (select 1 from public.watch_wheels where id = wheel_id and kind = 'list')) with check (public.is_watch_wheel_member(wheel_id, auth.uid()));
revoke update on public.watch_wheel_entries from authenticated;
grant update(watched) on public.watch_wheel_entries to authenticated;
revoke update on public.watch_wheels from authenticated;
grant update(title) on public.watch_wheels to authenticated;

create function public.create_shared_watchlist(list_title text, invited_user_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  if char_length(trim(list_title)) not between 1 and 80 then raise exception 'Invalid title'; end if;
  created_id := public.create_watch_wheel(invited_user_ids);
  update public.watch_wheels set kind = 'list', title = trim(list_title) where id = created_id;
  return created_id;
end $$;
create function public.spin_watch_wheel(requested_wheel uuid, expected_spun_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare wheel public.watch_wheels; result jsonb;
begin
  if not public.is_watch_wheel_member(requested_wheel, auth.uid()) then raise exception 'Not a member'; end if;
  select * into wheel from public.watch_wheels where id = requested_wheel and kind = 'wheel' for update;
  if not found then raise exception 'Wheel not found'; end if;
  if wheel.spun_at is distinct from expected_spun_at then return wheel.result_media; end if;
  if (select count(*) from public.watch_wheel_entries where wheel_id = requested_wheel) < 2 then raise exception 'At least two choices are required'; end if;
  select media into result from public.watch_wheel_entries where wheel_id = requested_wheel order by random() limit 1;
  update public.watch_wheels set result_media = result, spun_at = clock_timestamp() where id = requested_wheel;
  return result;
end $$;
create function public.notify_watch_wheel_invitation() returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_user uuid; room_kind text;
begin
  select owner_id, kind into owner_user, room_kind from public.watch_wheels where id = new.wheel_id;
  if new.user_id = owner_user then return new; end if;
  insert into public.notifications(user_id, actor_id, type, title, body, data, event_key)
  values(new.user_id, owner_user, 'watch_wheel_invite', case when room_kind = 'list' then 'Ortak listeye davetlisin' else 'Film gecesine davetlisin' end, 'Ortak bir listeye veya çarka eklendin.', jsonb_build_object('route',case when room_kind = 'list' then '/shared-lists' else '/watch-wheel' end,'wheelId',new.wheel_id,'kind',room_kind), 'wheel-invite:' || new.wheel_id)
  on conflict (user_id, event_key) where event_key is not null do nothing;
  return new;
end $$;
-- Runs after the transaction, so the notification route resolves the final room kind.
create constraint trigger watch_wheel_invitation after insert on public.watch_wheel_members deferrable initially deferred for each row execute function public.notify_watch_wheel_invitation();

revoke all on function public.create_shared_watchlist(text, uuid[]), public.spin_watch_wheel(uuid, timestamptz), public.users_blocked(uuid, uuid), public.can_view_profile_data(uuid) from public, anon;
grant execute on function public.create_shared_watchlist(text, uuid[]), public.spin_watch_wheel(uuid, timestamptz), public.users_blocked(uuid, uuid), public.can_view_profile_data(uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_wheel_entries') then alter publication supabase_realtime add table public.watch_wheel_entries; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_wheels') then alter publication supabase_realtime add table public.watch_wheels; end if;
  end if;
end $$;
commit;
