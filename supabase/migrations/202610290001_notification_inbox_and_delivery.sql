begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('friend_request', 'friend_accepted', 'comment_reply', 'comment_like', 'new_episode', 'watch_wheel_invite'));
alter table public.notifications add column if not exists event_key text;
create unique index if not exists notifications_unique_event on public.notifications(user_id, event_key) where event_key is not null;
create index if not exists notifications_unread on public.notifications(user_id, created_at desc) where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  new_episodes boolean not null default true,
  social boolean not null default true,
  push_enabled boolean not null default true,
  time_zone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now()
);
insert into public.notification_preferences(user_id) select id from auth.users on conflict do nothing;
alter table public.notification_preferences enable row level security;
create policy preferences_own on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create function public.initialize_notification_preferences() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger user_notification_preferences after insert on auth.users for each row execute function public.initialize_notification_preferences();

create function public.validate_notification_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then raise exception 'Invalid time zone'; end if;
  return new;
end $$;
create trigger notification_timezone before insert or update on public.notification_preferences for each row execute function public.validate_notification_timezone();

-- Device ownership is reassigned atomically when another account signs in.
create or replace function public.register_device_token(target_token text, target_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' or target_platform not in ('ios', 'android') then raise exception 'Invalid device registration'; end if;
  insert into public.devices(user_id, expo_push_token, platform, notifications_enabled)
  values (auth.uid(), target_token, target_platform, true)
  on conflict (expo_push_token) do update set user_id = excluded.user_id, platform = excluded.platform, notifications_enabled = true, updated_at = now();
end $$;

create table public.episode_sync_state (
  media_id bigint primary key,
  next_check_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text
);
create table public.episode_release_catalog (
  media_id bigint not null,
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  language text not null check (language in ('tr', 'en')),
  show_title text not null,
  episode_title text not null,
  air_date date not null,
  primary key (media_id, season_number, episode_number, language)
);
alter table public.episode_sync_state enable row level security;
alter table public.episode_release_catalog enable row level security;

create function public.track_episode_show() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.media_type = 'tv' and new.status in ('watching', 'completed') then
    insert into public.episode_sync_state(media_id) values (new.media_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger library_track_episode_show after insert or update on public.library_items for each row execute function public.track_episode_show();
insert into public.episode_sync_state(media_id) select distinct media_id from public.library_items where media_type = 'tv' and status in ('watching', 'completed') on conflict do nothing;

create function public.claim_episode_scans(batch_size integer default 20)
returns setof public.episode_sync_state language plpgsql security definer set search_path = '' as $$
begin
  return query with candidates as (
    select s.media_id from public.episode_sync_state s
    where s.next_check_at <= now() and (s.locked_until is null or s.locked_until < now())
      and exists (select 1 from public.library_items l where l.media_type = 'tv' and l.media_id = s.media_id and l.status in ('watching','completed'))
    order by s.next_check_at, s.media_id limit least(greatest(batch_size, 1), 20) for update skip locked
  ) update public.episode_sync_state s set locked_until = now() + interval '3 minutes'
    from candidates c where s.media_id = c.media_id returning s.*;
end $$;

create function public.enqueue_episode_notifications(at_time timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  insert into public.notifications(user_id, type, title, body, data, event_key)
  select l.user_id, 'new_episode',
    e.show_title || case when p.language = 'en' then ' · New episode' else ' · Yeni bölüm' end,
    'S' || e.season_number || case when p.language = 'en' then ' E' else ' B' end || e.episode_number || ' · ' || e.episode_title,
    jsonb_build_object('route', '/media/' || e.media_id, 'mediaType', 'tv', 'targetKey', 'episode:' || e.media_id || ':' || e.season_number || ':' || e.episode_number,
      'showTitle', e.show_title, 'episodeTitle', e.episode_title, 'season', e.season_number, 'episode', e.episode_number),
    'episode:' || e.media_id || ':' || e.season_number || ':' || e.episode_number
  from public.library_items l join public.profiles p on p.id = l.user_id
  join public.notification_preferences pref on pref.user_id = l.user_id and pref.new_episodes
  join public.episode_release_catalog e on e.media_id = l.media_id and e.language = p.language
  where l.media_type = 'tv' and l.status in ('watching','completed')
    and e.air_date between (at_time at time zone pref.time_zone)::date - 1 and (at_time at time zone pref.time_zone)::date
    and ((e.air_date + time '09:00') at time zone pref.time_zone) <= at_time
    and e.air_date >= (greatest(pref.created_at, l.created_at) at time zone pref.time_zone)::date
    and not exists (select 1 from public.episode_progress ep where ep.user_id = l.user_id and ep.media_id = e.media_id and ep.season_number = e.season_number and ep.episode_number = e.episode_number and ep.watched)
  on conflict (user_id, event_key) where event_key is not null do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  ticket_id text,
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  last_error text,
  unique (notification_id, device_id)
);
alter table public.notification_deliveries enable row level security;
create index notification_delivery_pending on public.notification_deliveries(next_attempt_at) where status in ('pending','processing');

-- Replace fire-and-forget HTTP calls with a transactional, retryable outbox.
drop trigger if exists notifications_push on public.notifications;
create or replace function public.push_social_notification() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_deliveries(notification_id, device_id)
    select new.id, d.id from public.devices d
    left join public.notification_preferences p on p.user_id = new.user_id
    where d.user_id = new.user_id and d.notifications_enabled and coalesce(p.push_enabled, true)
    on conflict do nothing;
  return new;
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function public.push_social_notification();

create function public.prepare_notification() returns trigger language plpgsql security definer set search_path = '' as $$
declare lang text; actor_name text;
begin
  if new.type <> 'new_episode' and exists (select 1 from public.notification_preferences where user_id = new.user_id and not social) then return null; end if;
  select language into lang from public.profiles where id = new.user_id;
  select coalesce(nullif(trim(first_name || ' ' || last_name), ''), username, case when lang = 'en' then 'Someone' else 'Bir kullanıcı' end) into actor_name from public.profiles where id = new.actor_id;
  new.data := new.data || jsonb_build_object('notificationId', new.id, 'userId', new.user_id, 'actorName', actor_name);
  if lang = 'en' then
    case new.type
      when 'friend_request' then new.title := 'New friend request'; new.body := coalesce(actor_name, 'Someone') || ' sent you a friend request.';
      when 'friend_accepted' then new.title := 'Friend request accepted'; new.body := coalesce(actor_name, 'Someone') || ' is now your friend.';
      when 'comment_reply' then new.title := 'New reply to your comment'; new.body := coalesce(actor_name, 'Someone') || ' replied to your comment.';
      when 'comment_like' then new.title := 'Your comment was liked'; new.body := coalesce(actor_name, 'Someone') || ' liked your comment.';
      when 'watch_wheel_invite' then
        if new.data->>'kind' = 'list' then new.title := 'Shared watchlist invitation'; new.body := coalesce(actor_name, 'Someone') || ' invited you to a shared watchlist.';
        else new.title := 'You are invited to movie night'; new.body := coalesce(actor_name, 'Someone') || ' added you to a shared watch wheel.'; end if;
      else null;
    end case;
  end if;
  return new;
end $$;
create trigger notifications_prepare before insert on public.notifications for each row execute function public.prepare_notification();

create function public.claim_push_deliveries(batch_size integer default 100)
returns table(id uuid, token text, title text, body text, data jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  update public.notification_deliveries set status = 'failed', locked_until = null, last_error = coalesce(last_error, 'Delivery attempt limit reached')
  where attempts >= 6 and status in ('pending','processing') and (locked_until is null or locked_until < now());
  return query with candidates as (
    select delivery.id from public.notification_deliveries delivery
    join public.notifications n on n.id = delivery.notification_id
    join public.devices d on d.id = delivery.device_id and d.user_id = n.user_id and d.notifications_enabled
    left join public.notification_preferences p on p.user_id = n.user_id
    where delivery.status in ('pending','processing') and delivery.attempts < 6
      and delivery.next_attempt_at <= now() and (delivery.locked_until is null or delivery.locked_until < now())
      and coalesce(p.push_enabled, true) and case when n.type = 'new_episode' then coalesce(p.new_episodes, true) else coalesce(p.social, true) end
    order by delivery.next_attempt_at, delivery.id limit least(greatest(batch_size, 1), 100) for update of delivery skip locked
  ), claimed as (
    update public.notification_deliveries delivery set status = 'processing', attempts = attempts + 1, locked_until = now() + interval '2 minutes'
    from candidates c where c.id = delivery.id returning delivery.*
  ) select c.id, d.expo_push_token, n.title, n.body, n.data from claimed c
    join public.notifications n on n.id = c.notification_id join public.devices d on d.id = c.device_id;
end $$;

-- Cron uses a random Vault secret; public API keys cannot invoke privileged jobs.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'episode_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'episode_worker_secret');
  end if;
end $$;
create function public.authorize_episode_worker(provided_secret text) returns boolean
language sql security definer set search_path = '' as $$
  select provided_secret is not null and length(provided_secret) = 64 and exists (
    select 1 from vault.decrypted_secrets where name = 'episode_worker_secret' and decrypted_secret = provided_secret
  );
$$;
create function public.configure_episode_worker(project_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
begin
  if project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Expected a Supabase project URL'; end if;
  select id into secret_id from vault.secrets where name = 'episode_project_url';
  if secret_id is null then perform vault.create_secret(project_url, 'episode_project_url');
  else perform vault.update_secret(secret_id, project_url); end if;
end $$;
create function public.invoke_episode_worker() returns bigint
language plpgsql security definer set search_path = '' as $$
declare project_url text; worker_secret text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'episode_project_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'episode_worker_secret';
  if project_url is null or worker_secret is null then return null; end if;
  select net.http_post(url := project_url || '/functions/v1/notification-worker', headers := jsonb_build_object('Content-Type','application/json','x-episode-worker-secret',worker_secret), body := '{}'::jsonb, timeout_milliseconds := 120000) into request_id;
  return request_id;
end $$;

revoke all on function public.claim_episode_scans(integer), public.enqueue_episode_notifications(timestamptz), public.claim_push_deliveries(integer), public.authorize_episode_worker(text), public.configure_episode_worker(text), public.invoke_episode_worker() from public, anon, authenticated;
grant execute on function public.claim_episode_scans(integer), public.enqueue_episode_notifications(timestamptz), public.claim_push_deliveries(integer), public.authorize_episode_worker(text), public.configure_episode_worker(text), public.invoke_episode_worker() to service_role;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'episode-notifications') then
    perform cron.schedule('episode-notifications', '*/5 * * * *', 'select public.invoke_episode_worker()');
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
commit;
