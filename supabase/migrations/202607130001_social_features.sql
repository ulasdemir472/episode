begin;

create extension if not exists pg_net with schema extensions;

alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists image_url text;
create index if not exists comments_parent_idx on public.comments(parent_comment_id) where deleted_at is null;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('friend_request', 'friend_accepted', 'comment_reply', 'comment_like')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.are_friends(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select viewer = owner or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = viewer and f.addressee_id = owner)
        or (f.requester_id = owner and f.addressee_id = viewer))
  );
$$;

create or replace function public.create_social_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_name text;
  target_user uuid;
  notification_type text;
  notification_title text;
  notification_body text;
  notification_data jsonb;
begin
  if tg_table_name = 'friendships' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      target_user := new.addressee_id;
      notification_type := 'friend_request';
      notification_title := 'Yeni arkadaşlık isteği';
      notification_data := jsonb_build_object('route', '/friends', 'friendshipId', new.id);
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      target_user := new.requester_id;
      notification_type := 'friend_accepted';
      notification_title := 'Arkadaşlık isteğin kabul edildi';
      notification_data := jsonb_build_object('route', '/profile/' || new.addressee_id, 'friendshipId', new.id);
    else
      return new;
    end if;
    select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), nullif('@' || p.username, ''), 'Bir kullanıcı')
      into actor_name from public.profiles p where p.id = case when target_user = new.requester_id then new.addressee_id else new.requester_id end;
    notification_body := actor_name || case when notification_type = 'friend_request' then ' sana arkadaşlık isteği gönderdi.' else ' artık arkadaşın.' end;
    insert into public.notifications(user_id, actor_id, type, title, body, data)
      values (target_user, case when target_user = new.requester_id then new.addressee_id else new.requester_id end, notification_type, notification_title, notification_body, notification_data);
    return new;
  end if;

  if tg_table_name = 'comments' and new.parent_comment_id is not null then
    select c.user_id into target_user from public.comments c where c.id = new.parent_comment_id;
    if target_user is null or target_user = new.user_id then return new; end if;
    select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), nullif('@' || p.username, ''), 'Bir kullanıcı') into actor_name from public.profiles p where p.id = new.user_id;
    insert into public.notifications(user_id, actor_id, type, title, body, data)
      values (target_user, new.user_id, 'comment_reply', 'Yorumuna yanıt geldi', actor_name || ' yorumuna yanıt verdi.', jsonb_build_object('route', '/media/' || new.media_id, 'targetKey', new.target_key));
    return new;
  end if;

  if tg_table_name = 'comment_likes' then
    select c.user_id into target_user from public.comments c where c.id = new.comment_id;
    if target_user is null or target_user = new.user_id then return new; end if;
    select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), nullif('@' || p.username, ''), 'Bir kullanıcı') into actor_name from public.profiles p where p.id = new.user_id;
    insert into public.notifications(user_id, actor_id, type, title, body, data)
      select target_user, new.user_id, 'comment_like', 'Yorumun beğenildi', actor_name || ' yorumunu beğendi.', jsonb_build_object('route', '/media/' || c.media_id, 'targetKey', c.target_key)
      from public.comments c where c.id = new.comment_id;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_notifications on public.friendships;
create trigger friendships_notifications after insert or update on public.friendships for each row execute function public.create_social_notification();
drop trigger if exists comment_reply_notifications on public.comments;
create trigger comment_reply_notifications after insert on public.comments for each row execute function public.create_social_notification();
drop trigger if exists comment_like_notifications on public.comment_likes;
create trigger comment_like_notifications after insert on public.comment_likes for each row execute function public.create_social_notification();

create or replace function public.push_social_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare device record;
begin
  for device in select expo_push_token from public.devices where user_id = new.user_id and notifications_enabled loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('to', device.expo_push_token, 'sound', 'default', 'title', new.title, 'body', new.body, 'data', new.data)
    );
  end loop;
  return new;
end;
$$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications for each row execute function public.push_social_notification();

alter table public.comment_likes enable row level security;
alter table public.notifications enable row level security;
drop policy if exists comment_likes_read on public.comment_likes;
create policy comment_likes_read on public.comment_likes for select using (true);
drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes for delete using (auth.uid() = user_id);
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists library_friends_read on public.library_items;
create policy library_friends_read on public.library_items for select using (public.are_friends(auth.uid(), user_id));
drop policy if exists progress_friends_read on public.episode_progress;
create policy progress_friends_read on public.episode_progress for select using (public.are_friends(auth.uid(), user_id));
drop policy if exists favorites_friends_read on public.favorites;
create policy favorites_friends_read on public.favorites for select using (public.are_friends(auth.uid(), user_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comment-images', 'comment-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists comment_images_public_read on storage.objects;
create policy comment_images_public_read on storage.objects for select using (bucket_id = 'comment-images');
drop policy if exists comment_images_insert_own on storage.objects;
create policy comment_images_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists comment_images_update_own on storage.objects;
create policy comment_images_update_own on storage.objects for update to authenticated using (bucket_id = 'comment-images' and owner_id = auth.uid()::text);
drop policy if exists comment_images_delete_own on storage.objects;
create policy comment_images_delete_own on storage.objects for delete to authenticated using (bucket_id = 'comment-images' and owner_id = auth.uid()::text);

grant execute on function public.are_friends(uuid, uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='comment_likes') then alter publication supabase_realtime add table public.comment_likes; end if;
  end if;
end $$;

commit;
