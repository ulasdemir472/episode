begin;

-- Episode şu an kapalı bir arkadaş topluluğu olarak kullanılıyor. Oturum açmış
-- üyeler birbirlerinin profil aktivitesini görebilir; yazma yetkileri yine sahibinde kalır.
drop policy if exists library_friends_read on public.library_items;
drop policy if exists progress_friends_read on public.episode_progress;
drop policy if exists favorites_friends_read on public.favorites;
drop policy if exists library_members_read on public.library_items;
drop policy if exists progress_members_read on public.episode_progress;
drop policy if exists favorites_members_read on public.favorites;
create policy library_members_read on public.library_items for select to authenticated using (true);
create policy progress_members_read on public.episode_progress for select to authenticated using (true);
create policy favorites_members_read on public.favorites for select to authenticated using (true);

create table if not exists public.watch_wheels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Bu gece ne izliyoruz?' check (char_length(trim(title)) between 1 and 80),
  result_media jsonb,
  spun_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_wheel_members (
  wheel_id uuid not null references public.watch_wheels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wheel_id, user_id)
);

create table if not exists public.watch_wheel_entries (
  id uuid primary key default gen_random_uuid(),
  wheel_id uuid not null references public.watch_wheels(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  media jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists watch_wheel_members_user_idx on public.watch_wheel_members(user_id, created_at desc);
create index if not exists watch_wheel_entries_wheel_idx on public.watch_wheel_entries(wheel_id, created_at);
create unique index if not exists watch_wheel_entries_unique_media_idx on public.watch_wheel_entries(wheel_id, (media->>'type'), (media->>'id'));

drop trigger if exists watch_wheels_updated_at on public.watch_wheels;
create trigger watch_wheels_updated_at before update on public.watch_wheels for each row execute function public.set_updated_at();

create or replace function public.is_watch_wheel_member(requested_wheel uuid, requested_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.watch_wheel_members where wheel_id = requested_wheel and user_id = requested_user);
$$;

create or replace function public.add_watch_wheel_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.watch_wheel_members (wheel_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists watch_wheel_add_owner on public.watch_wheels;
create trigger watch_wheel_add_owner after insert on public.watch_wheels for each row execute function public.add_watch_wheel_owner();

alter table public.watch_wheels enable row level security;
alter table public.watch_wheel_members enable row level security;
alter table public.watch_wheel_entries enable row level security;

drop policy if exists watch_wheels_read_member on public.watch_wheels;
drop policy if exists watch_wheels_insert_owner on public.watch_wheels;
drop policy if exists watch_wheels_update_member on public.watch_wheels;
drop policy if exists watch_wheels_delete_owner on public.watch_wheels;
drop policy if exists watch_wheel_members_read on public.watch_wheel_members;
drop policy if exists watch_wheel_members_insert_owner on public.watch_wheel_members;
drop policy if exists watch_wheel_members_delete on public.watch_wheel_members;
drop policy if exists watch_wheel_entries_read on public.watch_wheel_entries;
drop policy if exists watch_wheel_entries_insert on public.watch_wheel_entries;
drop policy if exists watch_wheel_entries_delete on public.watch_wheel_entries;

create policy watch_wheels_read_member on public.watch_wheels for select to authenticated using (public.is_watch_wheel_member(id, auth.uid()));
create policy watch_wheels_insert_owner on public.watch_wheels for insert to authenticated with check (owner_id = auth.uid());
create policy watch_wheels_update_member on public.watch_wheels for update to authenticated using (public.is_watch_wheel_member(id, auth.uid())) with check (public.is_watch_wheel_member(id, auth.uid()));
create policy watch_wheels_delete_owner on public.watch_wheels for delete to authenticated using (owner_id = auth.uid());
create policy watch_wheel_members_read on public.watch_wheel_members for select to authenticated using (public.is_watch_wheel_member(wheel_id, auth.uid()));
create policy watch_wheel_members_insert_owner on public.watch_wheel_members for insert to authenticated with check (exists (select 1 from public.watch_wheels where id = wheel_id and owner_id = auth.uid()));
create policy watch_wheel_members_delete on public.watch_wheel_members for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.watch_wheels where id = wheel_id and owner_id = auth.uid()));
create policy watch_wheel_entries_read on public.watch_wheel_entries for select to authenticated using (public.is_watch_wheel_member(wheel_id, auth.uid()));
create policy watch_wheel_entries_insert on public.watch_wheel_entries for insert to authenticated with check (added_by = auth.uid() and public.is_watch_wheel_member(wheel_id, auth.uid()));
create policy watch_wheel_entries_delete on public.watch_wheel_entries for delete to authenticated using (added_by = auth.uid() or exists (select 1 from public.watch_wheels where id = wheel_id and owner_id = auth.uid()));

grant execute on function public.is_watch_wheel_member(uuid, uuid) to authenticated;

commit;
