begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  username text unique,
  language text not null default 'tr' check (language in ('tr', 'en')),
  avatar_url text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null,
  status text not null check (status in ('watching', 'watchlist', 'completed', 'dropped')),
  media jsonb not null,
  progress jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create table if not exists public.episode_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id bigint not null,
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  watched boolean not null default true,
  watched_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id, season_number, episode_number)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null,
  media jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_key text not null,
  target_type text not null check (target_type in ('media', 'episode')),
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null,
  season_number integer,
  episode_number integer,
  score smallint not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_key),
  check ((target_type = 'media' and season_number is null and episode_number is null) or (target_type = 'episode' and media_type = 'tv' and season_number > 0 and episode_number > 0))
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_key text not null,
  target_type text not null check (target_type in ('media', 'episode')),
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null,
  season_number integer,
  episode_number integer,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  spoiler boolean not null default false,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((target_type = 'media' and season_number is null and episode_number is null) or (target_type = 'episode' and media_type = 'tv' and season_number > 0 and episode_number > 0))
);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_target_created_idx on public.comments(target_key, created_at desc) where deleted_at is null and moderation_status = 'visible';
create index if not exists ratings_target_idx on public.ratings(target_key);
create index if not exists episode_progress_user_media_idx on public.episode_progress(user_id, media_id) where watched = true;
create index if not exists library_items_user_status_idx on public.library_items(user_id, status);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.can_review_target(
  requested_user uuid,
  requested_target_type text,
  requested_media_type text,
  requested_media_id bigint,
  requested_season integer,
  requested_episode integer
) returns boolean
language sql stable security definer set search_path = '' as $$
  select requested_user = auth.uid() and case
    when requested_target_type = 'episode' then exists (
      select 1 from public.episode_progress ep
      where ep.user_id = requested_user and ep.media_id = requested_media_id
        and ep.season_number = requested_season and ep.episode_number = requested_episode and ep.watched
    )
    when requested_media_type = 'movie' then exists (
      select 1 from public.library_items li
      where li.user_id = requested_user and li.media_type = 'movie'
        and li.media_id = requested_media_id and li.status = 'completed'
    )
    else exists (
      select 1 from public.library_items li
      where li.user_id = requested_user and li.media_type = 'tv'
        and li.media_id = requested_media_id and li.status = 'completed'
    ) or exists (
      select 1 from public.episode_progress ep
      where ep.user_id = requested_user and ep.media_id = requested_media_id and ep.watched
    )
  end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists library_items_updated_at on public.library_items;
create trigger library_items_updated_at before update on public.library_items for each row execute function public.set_updated_at();
drop trigger if exists episode_progress_updated_at on public.episode_progress;
create trigger episode_progress_updated_at before update on public.episode_progress for each row execute function public.set_updated_at();
drop trigger if exists ratings_updated_at on public.ratings;
create trigger ratings_updated_at before update on public.ratings for each row execute function public.set_updated_at();
drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
drop trigger if exists devices_updated_at on public.devices;
create trigger devices_updated_at before update on public.devices for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.library_items enable row level security;
alter table public.episode_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;
alter table public.devices enable row level security;

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists library_own_all on public.library_items;
drop policy if exists progress_own_all on public.episode_progress;
drop policy if exists favorites_own_all on public.favorites;
drop policy if exists ratings_read on public.ratings;
drop policy if exists ratings_insert_watched on public.ratings;
drop policy if exists ratings_update_own_watched on public.ratings;
drop policy if exists ratings_delete_own on public.ratings;
drop policy if exists comments_read_visible on public.comments;
drop policy if exists comments_insert_watched on public.comments;
drop policy if exists comments_update_own on public.comments;
drop policy if exists reports_insert_own on public.comment_reports;
drop policy if exists reports_read_own on public.comment_reports;
drop policy if exists devices_own_all on public.devices;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy library_own_all on public.library_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy progress_own_all on public.episode_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy favorites_own_all on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ratings_read on public.ratings for select using (true);
create policy ratings_insert_watched on public.ratings for insert with check (
  auth.uid() = user_id and public.can_review_target(user_id, target_type, media_type, media_id, season_number, episode_number)
);
create policy ratings_update_own_watched on public.ratings for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and public.can_review_target(user_id, target_type, media_type, media_id, season_number, episode_number)
);
create policy ratings_delete_own on public.ratings for delete using (auth.uid() = user_id);

create policy comments_read_visible on public.comments for select using (deleted_at is null and moderation_status = 'visible');
create policy comments_insert_watched on public.comments for insert with check (
  auth.uid() = user_id and public.can_review_target(user_id, target_type, media_type, media_id, season_number, episode_number)
);
create policy comments_update_own on public.comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy reports_insert_own on public.comment_reports for insert with check (auth.uid() = reporter_id);
create policy reports_read_own on public.comment_reports for select using (auth.uid() = reporter_id);
create policy devices_own_all on public.devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant execute on function public.can_review_target(uuid, text, text, bigint, integer, integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
    ) then
      alter publication supabase_realtime add table public.comments;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ratings'
    ) then
      alter publication supabase_realtime add table public.ratings;
    end if;
  end if;
end $$;

commit;
