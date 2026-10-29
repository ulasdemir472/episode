begin;
-- Branch before accessing NEW fields: each trigger table has a different record type.
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

  if tg_table_name = 'comments' then
    if new.parent_comment_id is null then return new; end if;
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

commit;
