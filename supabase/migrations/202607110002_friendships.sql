begin;

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

drop trigger if exists friendships_updated_at on public.friendships;
create trigger friendships_updated_at before update on public.friendships for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;

drop policy if exists friendships_read_related on public.friendships;
drop policy if exists friendships_insert_requester on public.friendships;
drop policy if exists friendships_update_addressee on public.friendships;
drop policy if exists friendships_delete_related on public.friendships;

create policy friendships_read_related on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy friendships_insert_requester on public.friendships
  for insert with check (auth.uid() = requester_id and status = 'pending');

create policy friendships_update_addressee on public.friendships
  for update using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

create policy friendships_delete_related on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
    ) then
      alter publication supabase_realtime add table public.friendships;
    end if;
  end if;
end $$;

commit;
